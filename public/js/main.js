'use strict';

//Defining some global utility variables
var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var turnReady;

//Initialize turn/stun server here
//turnconfig will be defined in public/js/config.js
var pcConfig = turnConfig;

//Set local stream constraints
var localStreamConstraints = {
    audio: true,
    video: true,
    text : true
  };


// Prompting for room name:
var room = prompt('Enter room name:');

//Initializing socket.io
var socket = io.connect();

//Ask server to add in the room if room name is provided by the user
if (room !== '') {
  socket.emit('create or join', room);
  console.log('Attempted to create or  join room', room);
}

//Defining socket events

//Event - Client has created the room i.e. is the first member of the room
socket.on('created', function(room) {
  console.log('Created room ' + room);
  isInitiator = true;
});

//Event - Room is full
socket.on('full', function(room) {
  console.log('Room ' + room + ' is full');
});

//Event - Another client tries to join room
socket.on('join', function (room){
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
});

//Event - Client has joined the room
socket.on('joined', function(room) {
  console.log('joined: ' + room);
  isChannelReady = true;
});

//Event - server asks to log a message
socket.on('log', function(array) {
  console.log.apply(console, array);
});


//Event - for sending meta for establishing a direct connection using WebRTC
//The Driver code
socket.on('message', function(message, room) {
    console.log('Client received message:', message,  room);
    if (message === 'got user media') {
      maybeStart();
    } else if (message.type === 'offer') {
      if (!isInitiator && !isStarted) {
        maybeStart();
      }
      pc.setRemoteDescription(new RTCSessionDescription(message));
      doAnswer();
    } else if (message.type === 'answer' && isStarted) {
      pc.setRemoteDescription(new RTCSessionDescription(message));
    } else if (message.type === 'candidate' && isStarted) {
      var candidate = new RTCIceCandidate({
        sdpMLineIndex: message.label,
        candidate: message.candidate
      });
      pc.addIceCandidate(candidate);
    } else if (message === 'bye' && isStarted) {
      handleRemoteHangup();
    }
});
  


//Function to send message in a room
function sendMessage(message, room) {
  console.log('Client sending message: ', message, room);
  socket.emit('message', message, room);
}



//Displaying Local Stream and Remote Stream on webpage
var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
var sharedScreen = document.querySelector('#shareScreen');

console.log("Going to find Local media");
navigator.mediaDevices.getUserMedia(localStreamConstraints)
.then(gotStream)
.catch(function(e) {
  alert('getUserMedia() error: ' + e.name);
});

const screenShareButton = document.getElementById('screenShareButton');
screenShareButton.disabled = false;

//screenShareButton.disabled = true;


const shareScreen = async () => {
  const mediaStream = await getLocalScreenCaptureStream();

  const screenTrack = mediaStream.getVideoTracks()[0];
  sharedScreen.srcObject = screenTrack;

  if (screenTrack) {
    console.log('replace camera track with screen track');
    replaceTrack(screenTrack);
  }
};

const getLocalScreenCaptureStream = async () => {
  try {
    const constraints = { video: { cursor: 'always' }, audio: false };
    const screenCaptureStream = await navigator.mediaDevices.getDisplayMedia(constraints);

    
    return screenCaptureStream;
  } catch (error) {
    console.error('failed to get local screen', error);
  }
};

const replaceTrack = (newTrack) => {
  const sender = peerConnection.getSenders().find(sender =>
    sender.track.kind === newTrack.kind 
  );

  if (!sender) {
    console.warn('failed to find sender');

    return;
  }

  sender.replaceTrack(newTrack);
}


//If found local stream
function gotStream(stream) {
  console.log('Adding local stream.');
  localStream = stream;
  localVideo.srcObject = stream;
  sendMessage('got user media', room);
  if (isInitiator) {
    maybeStart();
  }
}


console.log('Getting user media with constraints', localStreamConstraints);

//If initiator, create the peer connection
function maybeStart() {
  console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady);
  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
    console.log('>>>>>> creating peer connection');
    createPeerConnection();
    pc.addStream(localStream);
    isStarted = true;
    console.log('isInitiator', isInitiator);
    if (isInitiator) {
      doCall();
    }
  }
}

//Sending bye if user closes the window
window.onbeforeunload = function() {
  sendMessage('bye', room);
};


//Creating peer connection
function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(pcConfig);
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
    console.log('Created RTCPeerConnnection');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

//Function to handle Ice candidates generated by the browser
function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    }, room);
  } else {
    console.log('End of candidates.');
  }
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

//Function to create offer
function doCall() {
  console.log('Sending offer to peer');
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

//Function to create answer for the received offer
function doAnswer() {
  console.log('Sending answer to peer.');
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function ShareScreen(){
  navigator.canShare
}

//Function to set description of local media
function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage(sessionDescription, room);
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

//Function to play remote stream as soon as this client receives it
function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  remoteStream = event.stream;
  remoteVideo.srcObject = remoteStream;
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

function hangup() {
  console.log('Hanging up.');
  stop();
  sendMessage('bye',room);
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  pc.close();
  pc = null;
}