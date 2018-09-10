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

const START=0;
const IN_TEST=1;
const SHOW_EVIDENCE=2;
const PLAYING_EVIDENCE=3;
const DECISION_STATE=4;
const INTERROGATION=5;
const POST_INTERROGATION=6;

window.onload = function() {
	console = new Console();
	console.log('Page loaded ...');
	videoInput = document.getElementById('videoInput');
	videoOutput = document.getElementById('videoOutput');
	setState(START);
	currentQuesNum=0;
}

window.onbeforeunload = function() {
	ws.close();
}

function setState(nextState) {
	switch (nextState) {
	case START:
		$('#test_inst').show();
		$('#test').show();
		$('#play_evidence').hide();
		$('#confirm_inst').hide();
		$('#playing_inst').hide();
		$('#stop').hide();
		$('#next').hide();
		$('#confirm').hide();
		$('#refresh').hide();
		$('#quesNum').hide();
		$('#playRecordedVideo').hide();
		$('#main_window').show();
		$('#decision_window').hide();
		break;		
	case IN_TEST:
		$('#test_inst').show();
		$('#test').attr('disabled', true);
		$('#play_evidence').hide();
		$('#confirm_inst').show();
		$('#playing_inst').hide();
		$('#stop').hide();
		$('#next').hide();
		$('#confirm').show();
		$('#refresh').show();
		$('#quesNum').hide();
		$('#playRecordedVideo').hide();
		$('#main_window').show();
		$('#decision_window').hide();
		break;
	case SHOW_EVIDENCE:
		$('#test_inst').hide();
		$('#test').hide();
		$('#play_evidence').show();
		$('#confirm_inst').hide();
		$('#playing_inst').hide();
		$('#stop').hide();
		$('#next').hide();
		$('#confirm').hide();
		$('#refresh').hide();
		$('#quesNum').hide();
		$('#playRecordedVideo').hide();
		$('#main_window').show();
		$('#decision_window').hide();
		break;
	case PLAYING_EVIDENCE:
		$('#test_inst').hide();
		$('#test').hide();
		$('#play_evidence').hide();
		$('#confirm_inst').hide();
		$('#playing_inst').hide();
		$('#stop').hide();
		$('#next').hide();
		$('#confirm').hide();
		$('#refresh').hide();
		$('#quesNum').hide();
		$('#playRecordedVideo').hide();
		$('#main_window').show();
		$('#decision_window').hide();
		break;
	case DECISION_STATE:
		$('#test_inst').hide();
		$('#test').hide();
		$('#play_evidence').hide();
		$('#confirm_inst').hide();
		$('#playing_inst').hide();
		$('#stop').hide();
		$('#next').hide();
		$('#confirm').hide();
		$('#refresh').hide();
		$('#quesNum').hide();
		$('#playRecordedVideo').hide();
		$('#main_window').hide();
		$('#decision_window').show();
		break;	
	case INTERROGATION:
		$('#test_inst').hide();
		$('#test').hide();
		$('#play_evidence').hide();
		$('#confirm_inst').hide();
		$('#playing_inst').hide();
		$('#stop').hide();
		$('#next').show();
		$('#confirm').hide();
		$('#refresh').hide();
		$('#quesNum').hide();
		$('#playRecordedVideo').hide();
		$('#main_window').show();
		$('#decision_window').hide();
		break;
	case POST_INTERROGATION:
		$('#test_inst').hide();
		$('#test').hide();
		$('#play_evidence').hide();
		$('#confirm_inst').hide();
		$('#playing_inst').hide();
		$('#stop').hide();
		$('#next').hide();
		$('#confirm').hide();
		$('#refresh').hide();
		$('#quesNum').show();
		$('#playRecordedVideo').show();
		$('#main_window').show();
		$('#decision_window').hide();
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
	case 'startLoopbackTesting':
		setState(IN_TEST);
		startResponse(parsedMessage);
		console.log('got response from test');
		break;
	case 'playResponse':
		if (state==PLAYING_EVIDENCE){
			showTimer();
			window.setTimeout(showDecision, 8000);
		}
		printResponse(parsedMessage);
		break;
	case 'postResponse':
		postResponse(parsedMessage);
		break;
	case 'decisionResponse':
		console.log('decision response working'); 
		setState(INTERROGATION);
		playNextQuestion();
		break;
	case 'evidenceResponse':
		printResponse(parsedMessage);
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
		setState(START);
	onError('Unrecognized message', parsedMessage);
	}
}

function showTimer(){
	
	var seconds = 8;
    function tick() {
        var counter = document.getElementById("counter");
        seconds--;
        counter.innerHTML = "0:" + (seconds < 10 ? "0" : "") + String(seconds);
        if( seconds > 0 ) {
            setTimeout(tick, 1000);
        } 
    }
    tick();
}

function showDecision(){
	console.log('decision state');
	setState(DECISION_STATE);
}


function submitDecision(){
	console.log('submit deciison************');
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
		webRtcPeer.generateOffer(onDecision);
	});
	
}


function onDecision(error, offerSdp) {
	if (error)
		return console.error('Error generating the offer');
	console.info('Invoking SDP offer callback function ' + location.host);
	decisionVal= document.getElementById('decisionVal').value;
	console.info('decision Val ' + decisionVal);
	
	var message = {
			id : 'submittedDecision',
			decisionVal : decisionVal,
			sdpOffer : offerSdp
	}
	sendMessage(message);
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
	setState(SHOW_EVIDENCE);
	hideSpinner(videoInput,videoOutput);
}

function playEvidence(){
	
	console.log("Starting to play evidence...");
	showSpinner(videoOutput);
	
	console.log('playing evidence: ');
	setState(PLAYING_EVIDENCE);

	var options = {
			remoteVideo : videoOutput,
			mediaConstraints : getConstraints(),
			onicecandidate : onIceCandidate
	}

	webRtcPeer = new kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options,
			function(error) {
		if (error)
			return console.error(error);
		webRtcPeer.generateOffer(onEvidenceOffer);
	});
}


function onEvidenceOffer(error, offerSdp) {
	if (error)
		return console.error('Error generating the offer');
	console.info('Invoking SDP offer callback function ' + location.host);
	var evidenceNum=2;
	
	var message = {
			id : 'playEvidence',
			evidenceNum : evidenceNum,
			sdpOffer : offerSdp
	}
	sendMessage(message);
}


function refresh(){
	window.location.reload(true);
}

function playNextQuestion() {
	console.log('play next question ...');
	currentQuesNum+=1;
	
	if (currentQuesNum>num_questions){
		setState(POST_INTERROGATION);
		showSpinner(videoInput, videoOutput);
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
	console.log('insidenext question: Invoking SDP offer callback function ' + location.host);
	var message = {
			id : 'nextQuestion',			
			quesNum : currentQuesNum,
			sdpOffer : offerSdp,
			mode :  $('input[name="mode"]:checked').val()
	}
	sendMessage(message);
	console.log('After sending message of nextQuestion ' );
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
			id : 'playRecordedVideo',
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

function printResponse(message) {
	webRtcPeer.processAnswer(message.sdpAnswer, function(error) {
		if (error)
			return console.error(error);
	});
}


function playResponse(message) {
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
	if (state==PLAYING_EVIDENCE){
		setState(IN_CALL);
	}else{
		setState(POST_CALL);
	}
	
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
