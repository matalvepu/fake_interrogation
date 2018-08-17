/*
 * (C) Copyright 2014-2016 Kurento (http://kurento.org/)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

var ws = new WebSocket('wss://' + location.host + '/recording');
var videoInput;
var videoOutput;
var webRtcPeer;
var state;
var currentQuesNum;

const num_questions=5;
const NO_CALL = 0;
const IN_TEST = 1; //user will be here when they are in loopback part
const IN_CALL = 2; // User will be here when they are answering the mental state question
const POST_CALL = 3;

window.onload = function() {
	console = new Console();
	console.log('Page loaded ...');
	videoInput = document.getElementById('videoInput');
	videoOutput = document.getElementById('videoOutput');
	setState(NO_CALL);
	currentQuesNum=0;
}

window.onbeforeunload = function() {
	ws.close();
}

function setState(nextState) {
	switch (nextState) {
	case NO_CALL:
		$('#stop').show();
		$('#next').hide();
		$('#confirm').hide();
		$('#refresh').hide();
		$('#quesNum').hide();
		$('#play').hide();
		break;
	case IN_TEST:
		$('#confirm').show();
		$('#refresh').show();
		$('#test').attr('disabled', true);
		break;
	case IN_CALL:
		$('#next').show();
		$('#confirm').hide();
		$('#refresh').hide();
		$('#test').hide();
		break;
	case POST_CALL:
		$('#stop').hide();
		$('#next').hide();
		$('#confirm').hide();
		$('#refresh').hide();
		$('#test').hide();
		$('#play').show();
		$('#quesNum').show();
		break;

	default:
		onError('Unknown state ' + nextState);
	return;
	}
	state = nextState;
}

ws.onmessage = function(message) {
	var parsedMessage = JSON.parse(message.data);
	console.info('Received message: ' + message.data);

	switch (parsedMessage.id) {
	case 'startResponse':
		startResponse(parsedMessage);
		console.log('got response from test');
		break;
	case 'playResponse':
		playResponse(parsedMessage);
		break;
	case 'postResponse':
		postResponse(parsedMessage);
		break;
	case 'playEnd':
		playEnd();
		break;
	case 'error':
		setState(NO_CALL);
		onError('Error message from server: ' + parsedMessage.message);
		break;
	case 'iceCandidate':
		webRtcPeer.addIceCandidate(parsedMessage.candidate, function(error) {
			if (error)
				return console.error('Error adding candidate: ' + error);
		});
		break;
	case 'stopped':
		break;
	case 'paused':
		break;
	case 'recording':
		break;
	default:
		setState(NO_CALL);
	onError('Unrecognized message', parsedMessage);
	}
}

function test() {
	
	console.log('Testing if loopback is working ...');
	// Disable start button
	setState(IN_TEST);
	showSpinner(videoInput, videoOutput);
	console.log('Creating WebRtcPeer and generating local sdp offer ...');

	var options = {
			localVideo : videoInput,
			remoteVideo : videoOutput,
			mediaConstraints : getConstraints(),
			onicecandidate : onIceCandidate
	}

	webRtcPeer = new kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options,
			function(error) {
		if (error)
			return console.error(error);
		webRtcPeer.generateOffer(onTest);
	});
}

function onTest(error, offerSdp) {
	if (error)
		return console.error('Error generating the offer');
	console.info('Invoking SDP offer callback function ' + location.host);
	var message = {
			id : 'test',
			sdpOffer : offerSdp,
			mode :  $('input[name="mode"]:checked').val()
	}
	sendMessage(message);
}

function confirm(){
	setState(IN_CALL);
	playNextQuestion();
}

function refresh(){
	window.location.reload(true);
}

function playNextQuestion() {
	setState(IN_CALL);
	console.log('play next question ...');
	currentQuesNum+=1;
	
	if (currentQuesNum==num_questions){
		$('#stop').show();
	}
	
	if (currentQuesNum>num_questions){
		stop();
		return;
	}
	
	
	console.log(currentQuesNum);
	showSpinner(videoInput, videoOutput);
	console.log('Creating WebRtcPeer and generating local sdp offer ...');

	var options = {
			localVideo : videoInput,
			remoteVideo : videoOutput,
			mediaConstraints : getConstraints(),
			onicecandidate : onIceCandidate
	}

	webRtcPeer = new kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options,
			function(error) {
		if (error)
			return console.error(error);
		webRtcPeer.generateOffer(onNextQuestion);
	});
}


function onNextQuestion(error, offerSdp) {
	if (error)
		return console.error('Error generating the offer');
	console.info('Invoking SDP offer callback function ' + location.host);
	var message = {
			id : 'nextQuestion',
			sdpOffer : offerSdp,
			quesNum : currentQuesNum,
			mode :  $('input[name="mode"]:checked').val()
	}
	sendMessage(message);
}

function onError(error) {
	console.error(error);
}

function onIceCandidate(candidate) {
	console.log('Local candidate' + JSON.stringify(candidate));

	var message = {
			id : 'onIceCandidate',
			candidate : candidate
	};
	sendMessage(message);
}

function startResponse(message) {
	setState(IN_TEST);
	console.log('SDP answer received from server. Processing ...');

	webRtcPeer.processAnswer(message.sdpAnswer, function(error) {
		if (error)
			return console.error(error);
	});
}

function stop() {
	
	var stopMessageId = (state == IN_CALL) ? 'stop' : 'stopPlay';
	stopMessageId='stopPlay';
	console.log('Stopping video while in ' + state + '...');
	setState(POST_CALL);
	if (webRtcPeer) {
		webRtcPeer.dispose();
		webRtcPeer = null;

		var message = {
				id : stopMessageId
		}
		sendMessage(message);
	}
	hideSpinner(videoInput, videoOutput);
}

function playRecordedVideo(){
		
	console.log("Starting to play recorded video...");
	// Disable start button
	showSpinner(videoOutput);

	console.log('playing recorded video ...ques num: ');
	console.log(document.getElementById('quesNum').value);
	var options = {
			remoteVideo : videoOutput,
			mediaConstraints : getConstraints(),
			onicecandidate : onIceCandidate
	}

	webRtcPeer = new kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options,
			function(error) {
		if (error)
			return console.error(error);
		webRtcPeer.generateOffer(onPlayOffer);
	});
}

function onPlayOffer(error, offerSdp) {
	if (error)
		return console.error('Error generating the offer');
	console.info('Invoking SDP offer callback function ' + location.host);
	quesNum= document.getElementById('quesNum').value;
	
	var message = {
			id : 'play',
			quesNum : quesNum,
			sdpOffer : offerSdp
	}
	sendMessage(message);
}

function getConstraints() {
	var mode = $('input[name="mode"]:checked').val();
	var constraints = {
			audio : true,
			video : true
	}

	if (mode == 'video-only') {
		constraints.audio = false;
	} else if (mode == 'audio-only') {
		constraints.video = false;
	}
	
	return constraints;
}


function playResponse(message) {
	setState(IN_CALL);
	webRtcPeer.processAnswer(message.sdpAnswer, function(error) {
		if (error)
			return console.error(error);
	});
}

function postResponse(message) {
	setState(POST_CALL);
	webRtcPeer.processAnswer(message.sdpAnswer, function(error) {
		if (error)
			return console.error(error);
	});
}

function playEnd() {
	setState(POST_CALL);
	hideSpinner(videoInput, videoOutput);
}

function sendMessage(message) {
	var jsonMessage = JSON.stringify(message);
	console.log('Senging message: ' + jsonMessage);
	ws.send(jsonMessage);
}

function showSpinner() {
	for (var i = 0; i < arguments.length; i++) {
		arguments[i].poster = './img/transparent-1px.png';
		arguments[i].style.background = "center transparent url('./img/spinner.gif') no-repeat";
	}
}

function hideSpinner() {
	for (var i = 0; i < arguments.length; i++) {
		arguments[i].src = '';
		arguments[i].poster = './img/webrtc.png';
		arguments[i].style.background = '';
	}
}
/**
 * Lightbox utility (to display media pipeline image in a modal dialog)
 */
$(document).delegate('*[data-toggle="lightbox"]', 'click', function(event) {
	event.preventDefault();
	$(this).ekkoLightbox();
});
