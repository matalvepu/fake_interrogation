/*
 * (C) Copyright 2015-2016 Kurento (http://kurento.org/)
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
 */
package org.kurento.tutorial.helloworld;

import java.io.IOException;

import org.kurento.client.EndOfStreamEvent;
import org.kurento.client.ErrorEvent;
import org.kurento.client.EventListener;
import org.kurento.client.IceCandidate;
import org.kurento.client.IceCandidateFoundEvent;
import org.kurento.client.KurentoClient;
import org.kurento.client.MediaPipeline;
import org.kurento.client.MediaProfileSpecType;
import org.kurento.client.MediaType;
import org.kurento.client.PausedEvent;
import org.kurento.client.PlayerEndpoint;
import org.kurento.client.RecorderEndpoint;
import org.kurento.client.RecordingEvent;
import org.kurento.client.StoppedEvent;
import org.kurento.client.WebRtcEndpoint;
import org.kurento.jsonrpc.JsonUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import java.util.Date;
import java.text.SimpleDateFormat;

/**
 * Hello World with recording handler (application and media logic).
 *
 * @author Boni Garcia (bgarcia@gsyc.es)
 * @author David Fernandez (d.fernandezlop@gmail.com)
 * @author Radu Tom Vlad (rvlad@naevatec.com)
 * @author Ivan Gracia (igracia@kurento.org)
 * @since 6.1.1
 */
public class HelloWorldRecHandler extends TextWebSocketHandler {

//  private String RECORDER_FILE_PATH;
	
  private static final String INTERROGATION_FILE_PATH = "file:///tmp/interrogation.webm";
  private static final String INTERROGATION1_FILE_PATH = "file:///tmp/interrogation1.webm";
  
  private final String interrogatorFileRoot="file:///tmp/fake";

  private final Logger log = LoggerFactory.getLogger(HelloWorldRecHandler.class);
  private static final Gson gson = new GsonBuilder().create();

  @Autowired
  private UserRegistry registry;

  @Autowired
  private KurentoClient kurento;

  @Override
  public void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
    JsonObject jsonMessage = gson.fromJson(message.getPayload(), JsonObject.class);
    
    log.info("Incoming message id: {}", jsonMessage.get("id").getAsString());

    UserSession user = registry.getBySession(session);
       
    if (user != null) {
      log.debug("Incoming message from user '{}': {}", user.getId(), jsonMessage);
    } else {
      log.debug("Incoming message from new user: {}", jsonMessage);
    }

    switch (jsonMessage.get("id").getAsString()) {   
      case "test":
    	test(session,jsonMessage);
    	break;
      case "nextQuestion":
    	log.info("got the request of nextQuestion before user checking");
    	if (user!=null) {
    		log.info("got the request of nextQuestion");
    		playNextQuestion(session,jsonMessage);
    	}    	
    	break;
      case "stop":
        if (user != null) {
          user.stop();
        }        
      case "stopPlay":
        if (user != null) {
          user.stop();
          user.release();
        }
        break;
      case "submittedDecision": 
    	  if (user!=null) {
//    		  user.release();
    		  storeDecision(session,jsonMessage);
    	  }
    	  break;
      case "playEvidence":
    	  if (user!=null) {
//    		user.release();
      		playEvidence(session, jsonMessage);
      	 }
		  break;
          
      case "playRecordedVideo":
        playRecordedVideo(session, jsonMessage);
        break;
        
      case "onIceCandidate": {
        JsonObject jsonCandidate = jsonMessage.get("candidate").getAsJsonObject();

        if (user != null) {
          IceCandidate candidate = new IceCandidate(jsonCandidate.get("candidate").getAsString(),
              jsonCandidate.get("sdpMid").getAsString(),
              jsonCandidate.get("sdpMLineIndex").getAsInt());
          user.addCandidate(candidate);
        }
        break;
      }
      default:
        sendError(session, "Invalid message with id " + jsonMessage.get("id").getAsString());
        break;
    }
  }

  @Override
  public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
    super.afterConnectionClosed(session, status);
    registry.removeBySession(session);
  }
  
  
  private void playEvidence(final WebSocketSession session, JsonObject jsonMessage) {
	  try {
		  UserSession user = registry.getBySession(session);	  
		  String recorderFileRoot, recorderFilePath;		  
		  String evidenceNum= jsonMessage.get("evidenceNum").getAsString();
		  log.info("Evidence Num: '{}'", evidenceNum);
		  recorderFilePath = "file:///tmp/evidence_"+evidenceNum+".webm";		
		  log.info("recorder file path : '{}'", recorderFilePath);
		  play(session,jsonMessage,recorderFilePath);
		  user.setEvidenceNum(evidenceNum);
	  }catch (Throwable t) {
	      log.error("Play evidence error", t);
	      sendError(session, t.getMessage());
	    }
	 	  
  }
  
  private void storeDecision(final WebSocketSession session, JsonObject jsonMessage) {
	  try {
		  UserSession user = registry.getBySession(session);	  	  
		  String decisionVal= jsonMessage.get("decisionVal").getAsString();
		  user.setDecisionVal(decisionVal);
		  log.info("Decision Val : '{}'", decisionVal);
		  
		  JsonObject response = new JsonObject();
		  response.addProperty("id", "decisionResponse");
		  response.addProperty("response", "stored decision");		  
		  
		  log.debug("Sending message of decision respone {}", response);
		  session.sendMessage(new TextMessage(response.toString()));
		  log.info("Sent the decision respone");
		  
	  }catch (Throwable t) {
	      log.error("Decision  error", t);
	      sendError(session, t.getMessage());
	    }
	 	  
  }
  
  private void play(final WebSocketSession session, JsonObject jsonMessage, String recorderFilePath) {
	  try {
	      
	      UserSession user = registry.getBySession(session);	  
	      // 1. Media logic
	      final MediaPipeline pipeline = kurento.createMediaPipeline();
	      WebRtcEndpoint webRtcEndpoint = new WebRtcEndpoint.Builder(pipeline).build();
	      PlayerEndpoint player = new PlayerEndpoint.Builder(pipeline, recorderFilePath).build();
	      player.connect(webRtcEndpoint);

	      // Player listeners
	      player.addErrorListener(new EventListener<ErrorEvent>() {
	        @Override
	        public void onEvent(ErrorEvent event) {
	          log.info("ErrorEvent for session '{}': {}", session.getId(), event.getDescription());
//	          sendPlayEnd(session, pipeline);
	        }
	      });
	      player.addEndOfStreamListener(new EventListener<EndOfStreamEvent>() {
	        @Override
	        public void onEvent(EndOfStreamEvent event) {
	          log.info("EndOfStreamEvent for session '{}'", session.getId());
//	          sendPlayEnd(session, pipeline);
	        }
	      });

	      // 2. Store user session
	      user.setMediaPipeline(pipeline);
	      user.setWebRtcEndpoint(webRtcEndpoint);
	      // 3. SDP negotiation
	      String sdpOffer = jsonMessage.get("sdpOffer").getAsString();
//	      log.info("play  sdp answer : {}", sdpOffer);
	      String sdpAnswer = webRtcEndpoint.processOffer(sdpOffer);

	     
	      // 4. Gather ICE candidates
	      webRtcEndpoint.addIceCandidateFoundListener(new EventListener<IceCandidateFoundEvent>() {

	        @Override
	        public void onEvent(IceCandidateFoundEvent event) {
	          JsonObject response = new JsonObject();
	          response.addProperty("id", "iceCandidate");
	          response.add("candidate", JsonUtils.toJsonObject(event.getCandidate()));
	          try {
	            synchronized (session) {
	              session.sendMessage(new TextMessage(response.toString()));
	            }
	          } catch (IOException e) {
	            log.error(e.getMessage());
	          }
	        }
	      });

	      // 5. Play recorded stream
	      player.play();
	      
	      JsonObject response = new JsonObject();
	      response.addProperty("id", "playResponse");
	      response.addProperty("sdpAnswer", sdpAnswer);
	     

	      synchronized (session) {
	        session.sendMessage(new TextMessage(response.toString()));
	      }

	      webRtcEndpoint.gatherCandidates();
	    } catch (Throwable t) {
	      log.error("Play error", t);
	      sendError(session, t.getMessage());
	    }  
	
  }
  
  private void playNextQuestion(final WebSocketSession session, JsonObject jsonMessage) {

	  
	  try {
	      
		  UserSession user = registry.getBySession(session);
		  String questionNum=jsonMessage.get("quesNum").getAsString();
		  
		  if (questionNum=="1") {
	          user.release();
		  }else {
			  user.stop();
	          user.release();
		  }
		  
		  String recorderFileRoot = user.getRecorderFileRoot();
		  String recorderFilePath = recorderFileRoot+"_"+questionNum+".webm";
	      
	      // 1. Media logic (webRtcEndpoint in loopback)
	      final MediaPipeline pipeline = kurento.createMediaPipeline();
	      final WebRtcEndpoint webRtcEndpoint = new WebRtcEndpoint.Builder(pipeline).build();

	      MediaProfileSpecType profile = getMediaProfileFromMessage(jsonMessage);

	      RecorderEndpoint recorder = new RecorderEndpoint.Builder(pipeline, recorderFilePath)
	      .withMediaProfile(profile).build();

	      recorder.addRecordingListener(new EventListener<RecordingEvent>() {

	        @Override
	        public void onEvent(RecordingEvent event) {
	          JsonObject response = new JsonObject();
	          response.addProperty("id", "recording");
	          try {
	            synchronized (session) {
	              session.sendMessage(new TextMessage(response.toString()));
	            }
	          } catch (IOException e) {
	            log.error(e.getMessage());
	          }
	        }

	      });


	      connectAccordingToProfile(webRtcEndpoint, recorder, profile);
	      
	      String interrogatorFilePath=interrogatorFileRoot+"_"+questionNum+".webm";
	      //play recorder
	      PlayerEndpoint player = new PlayerEndpoint.Builder(pipeline, interrogatorFilePath).build();
	      player.connect(webRtcEndpoint);

	      // Player listeners
	      player.addErrorListener(new EventListener<ErrorEvent>() {
	        @Override
	        public void onEvent(ErrorEvent event) {
	          log.info("ErrorEvent for session '{}': {}", session.getId(), event.getDescription());
	          sendPlayEnd(session, pipeline);
	        }
	      });
	      
	      player.addEndOfStreamListener(new EventListener<EndOfStreamEvent>() {
	        @Override
	        public void onEvent(EndOfStreamEvent event) {
	          log.info("EndOfStreamEvent for session '{}'", session.getId());
	          //player.release();
	          //sendPlayEnd(session, pipeline);
	          //webRtcEndpoint.release();
	       
	        }
	      });

	      // 2. Store user session
	      user.setMediaPipeline(pipeline);
	      user.setWebRtcEndpoint(webRtcEndpoint);
	      user.setRecorderEndpoint(recorder);
//	      registry.register(user);

	      // 3. SDP negotiation
	      String sdpOffer = jsonMessage.get("sdpOffer").getAsString();
	      String sdpAnswer = webRtcEndpoint.processOffer(sdpOffer);

	      // 4. Gather ICE candidates
	      webRtcEndpoint.addIceCandidateFoundListener(new EventListener<IceCandidateFoundEvent>() {

	        @Override
	        public void onEvent(IceCandidateFoundEvent event) {
	          JsonObject response = new JsonObject();
	          response.addProperty("id", "iceCandidate");
	          response.add("candidate", JsonUtils.toJsonObject(event.getCandidate()));
	          try {
	            synchronized (session) {
	              session.sendMessage(new TextMessage(response.toString()));
	            }
	          } catch (IOException e) {
	            log.error(e.getMessage());
	          }
	        }
	      });

	      JsonObject response = new JsonObject();
	      response.addProperty("id", "playResponse");
	      response.addProperty("sdpAnswer", sdpAnswer);

	      synchronized (user) {
	        session.sendMessage(new TextMessage(response.toString()));
	      }

	      webRtcEndpoint.gatherCandidates();
	      recorder.record();
	      player.play();
	      
	    } catch (Throwable t) {
	      log.error("Start error", t);
	      sendError(session, t.getMessage());
	    }
	  
	  
  }
  
  
  private void test(final WebSocketSession session, JsonObject jsonMessage) {
	    try {	    	            
	      	 		  
		  String timeStamp = new SimpleDateFormat("yyyy.MM.dd.HH.mm.ss").format(new Date());
	      String recorderFileRoot = "file:///tmp/mental_state_"+timeStamp;
	      
	      // 1. Media logic (webRtcEndpoint in loopback)
	      final MediaPipeline pipeline = kurento.createMediaPipeline();
	      final WebRtcEndpoint webRtcEndpoint = new WebRtcEndpoint.Builder(pipeline).build();
	      webRtcEndpoint.connect(webRtcEndpoint);
	      
	      String baselineFilePath=recorderFileRoot+"_baseline.webm" ;
	      
	      MediaProfileSpecType profile = getMediaProfileFromMessage(jsonMessage);
	      RecorderEndpoint recorder = new RecorderEndpoint.Builder(pipeline, baselineFilePath)
	      .withMediaProfile(profile).build();
	      
	      recorder.addRecordingListener(new EventListener<RecordingEvent>() {

	        @Override
	        public void onEvent(RecordingEvent event) {
	          JsonObject response = new JsonObject();
	          response.addProperty("id", "recording");
	          try {
	            synchronized (session) {
	              session.sendMessage(new TextMessage(response.toString()));
	            }
	          } catch (IOException e) {
	            log.error(e.getMessage());
	          }
	        }

	      });

	      connectAccordingToProfile(webRtcEndpoint, recorder, profile);
	      
	      // 2. Creating user profile
	      UserSession user = new UserSession(session);
	      user.setMediaPipeline(pipeline);
	      user.setWebRtcEndpoint(webRtcEndpoint);
	      user.setRecorderFileRoot(recorderFileRoot);
	      user.setRecorderEndpoint(recorder);
	      registry.register(user);

	      // 3. SDP negotiation
	      String sdpOffer = jsonMessage.get("sdpOffer").getAsString();
	      String sdpAnswer = webRtcEndpoint.processOffer(sdpOffer);

	      // 4. Gather ICE candidates
	      webRtcEndpoint.addIceCandidateFoundListener(new EventListener<IceCandidateFoundEvent>() {

	        @Override
	        public void onEvent(IceCandidateFoundEvent event) {
	          JsonObject response = new JsonObject();
	          response.addProperty("id", "iceCandidate");
	          response.add("candidate", JsonUtils.toJsonObject(event.getCandidate()));
	          try {
	            synchronized (session) {
	              session.sendMessage(new TextMessage(response.toString()));
	            }
	          } catch (IOException e) {
	            log.error(e.getMessage());
	          }
	        }
	      });

	      JsonObject response = new JsonObject();
	      response.addProperty("id", "startLoopbackTesting");
	      response.addProperty("sdpAnswer", sdpAnswer);

	      synchronized (user) {
	        session.sendMessage(new TextMessage(response.toString()));
	      }

	      webRtcEndpoint.gatherCandidates();

	      recorder.record();
	    } catch (Throwable t) {
	      log.error("Start error", t);
	      sendError(session, t.getMessage());
	    }
}


  private MediaProfileSpecType getMediaProfileFromMessage(JsonObject jsonMessage) {

    MediaProfileSpecType profile;
    switch (jsonMessage.get("mode").getAsString()) {
      case "audio-only":
        profile = MediaProfileSpecType.WEBM_AUDIO_ONLY;
        break;
      case "video-only":
        profile = MediaProfileSpecType.WEBM_VIDEO_ONLY;
        break;
      default:
        profile = MediaProfileSpecType.WEBM;
    }

    return profile;
  }

  private void connectAccordingToProfile(WebRtcEndpoint webRtcEndpoint, RecorderEndpoint recorder,
      MediaProfileSpecType profile) {
    switch (profile) {
      case WEBM:
        webRtcEndpoint.connect(recorder, MediaType.AUDIO);
        webRtcEndpoint.connect(recorder, MediaType.VIDEO);
        break;
      case WEBM_AUDIO_ONLY:
        webRtcEndpoint.connect(recorder, MediaType.AUDIO);
        break;
      case WEBM_VIDEO_ONLY:
        webRtcEndpoint.connect(recorder, MediaType.VIDEO);
        break;
      default:
        throw new UnsupportedOperationException("Unsupported profile for this tutorial: " + profile);
    }
  }
  
  //it will play the recorded video that were saved after answers
  private void playRecordedVideo(final WebSocketSession session, JsonObject jsonMessage) {
    try {
      
      UserSession user = registry.getBySession(session);	  
	  String recorderFileRoot, recorderFilePath;
	  
	  if (jsonMessage.has("quesNum")) {	  
		  String questionNum=jsonMessage.get("quesNum").getAsString();
		  recorderFileRoot = user.getRecorderFileRoot();
		  recorderFilePath = recorderFileRoot+"_"+questionNum+".webm";
	  }else {
		  String evidenceNum= jsonMessage.get("evidenceNum").getAsString();
		  recorderFilePath = "file:///tmp/evidence_"+evidenceNum+".webm";
	  }
	  play(session,jsonMessage,recorderFilePath);
	  
    }catch (Throwable t) {
	      log.error("Play evidence error", t);
	      sendError(session, t.getMessage());
	  }
     
  }

  public void sendPlayEnd(WebSocketSession session, MediaPipeline pipeline) {
    try {
      JsonObject response = new JsonObject();
      response.addProperty("id", "playEnd");
      session.sendMessage(new TextMessage(response.toString()));
    } catch (IOException e) {
      log.error("Error sending playEndOfStream message", e);
    }
    // Release pipeline
    pipeline.release();
  }

  private void sendError(WebSocketSession session, String message) {
    try {
      JsonObject response = new JsonObject();
      response.addProperty("id", "error");
      response.addProperty("message", message);
      session.sendMessage(new TextMessage(response.toString()));
    } catch (IOException e) {
      log.error("Exception sending message", e);
    }
  }
}
