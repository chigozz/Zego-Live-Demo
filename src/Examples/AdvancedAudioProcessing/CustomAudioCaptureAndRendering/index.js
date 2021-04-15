// require('../../../../jquery')
// let appID;   // from  /src/KeyCenter.js
// let server;  // from  /src/KeyCenter.js
// let tokenUrl;  // from  /src/KeyCenter.js

// ============================================================== 
// This part of the code defines the default values and global values 
// ============================================================== 

let userID = Util.getBrow() + '_' + new Date().getTime();
let roomID = '0022'
let streamID = '0022'

let zg = null;
let isStart = false;
let localStream = null;
let remoteStream = null;
// part end

// ============================================================== 
// This part of the code uses the SDK
// ==============================================================  

function createZegoExpressEngine() {
  zg = new ZegoExpressEngine(appID, server);
  window.zg = zg
}

async function checkSystemRequirements() {
  console.log('sdk version is', zg.getVersion());
  try {
      const result = await zg.checkSystemRequirements();

      console.warn('checkSystemRequirements ', result);
      !result.videoCodec.H264 && $('#videoCodeType option:eq(1)').attr('disabled', 'disabled');
      !result.videoCodec.VP8 && $('#videoCodeType option:eq(2)').attr('disabled', 'disabled');

      if (!result.webRTC) {
          console.log('browser is not support webrtc!!');
          return false;
      } else if (!result.videoCodec.H264 && !result.videoCodec.VP8) {
        console.log('browser is not support H264 and VP8');
          return false;
      } else if (result.videoCodec.H264) {
          supportScreenSharing = result.screenSharing;
          if (!supportScreenSharing) console.log('browser is not support screenSharing');
          previewVideo = $('#previewVideo')[0];
          // start();
      } else {
        console.log('不支持H264，请前往混流转码测试');
      }

      return true;
  } catch (err) {
      console.error('checkSystemRequirements', err);
      return false;
  }
}

async function enumDevices() {
  const audioInputList = [],
      videoInputList = [];
  const deviceInfo = await zg.enumDevices();

  deviceInfo &&
      deviceInfo.microphones.map((item, index) => {
          if (!item.deviceName) {
              item.deviceName = 'microphone' + index;
          }
          audioInputList.push(' <option value="' + item.deviceID + '">' + item.deviceName + '</option>');
          console.log('microphone: ' + item.deviceName);
          return item;
      });

  deviceInfo &&
      deviceInfo.cameras.map((item, index) => {
          if (!item.deviceName) {
              item.deviceName = 'camera' + index;
          }
          videoInputList.push(' <option value="' + item.deviceID + '">' + item.deviceName + '</option>');
          console.log('camera: ' + item.deviceName);
          return item;
      });

  audioInputList.push('<option value="0">禁止</option>');
  videoInputList.push('<option value="0">禁止</option>');

  $('#MirrorDevices').html(audioInputList.join(''));
  $('#CameraDevices').html(videoInputList.join(''));
}

function initEvent() {
  zg.on('publisherStateUpdate', result => {
    if(result.state === "PUBLISHING") {
      $('#pushlishInfo-id').text(result.streamID)
    } else if(result.state === "NO_PUBLISH") {
      $('#pushlishInfo-id').text('')
    }
  })

  zg.on('publishQualityUpdate', (streamId, stats) => {
    console.warn('publishQualityUpdate', streamId, stats);
  })
}

function clearStream() {

  localStream && zg.destroyStream(localStream);  
  remoteStream && zg.destroyStream(remoteStream);
  remoteStream = null;
  localStream = null;
  $('#pubshlishVideo')[0].srcObject = null;
  $('#playVideo')[0].srcObject = null;
  isStart = false
}

function setLogConfig() {
  let config = localStorage.getItem('logConfig')
  const DebugVerbose = localStorage.getItem('DebugVerbose') === 'true' ? true : false
  if(config) {
    config = JSON.parse(config)
    zg.setLogConfig({
      logLevel: config.logLevel,
      remoteLogLevel: config.remoteLogLevel,
      logURL: '',
  });
  }
  zg.setDebugVerbose(DebugVerbose);
}

function loginRoom(roomId, userId, userName) {
  return new Promise((resolve, reject) => {
    $.get(
      tokenUrl,
      {
        app_id: appID,
        id_name: userID
      },
      async (token) => {
        try {
          await zg.loginRoom(roomId, token, {
            userID: userId,
            userName
          });
          resolve()
        } catch (err) {
          reject()
        }
      }
    );
  })
}

function logoutRoom(roomId) {
	zg.logoutRoom(roomId);
}

async function startPublishingStream (streamId) {
  try {
    const audio = $('#customAudio')[0];
    localStream = await zg.createStream({
      custom: {
        source: audio
      }
    });
    zg.startPublishingStream(streamId, localStream);
    $('#pubshlishVideo')[0].srcObject = localStream;
    return true
  } catch(err) {
    console.error(err);
    return false
  }
  
}

async function stopPublishingStream(streamId) {
  zg.stopPublishingStream(streamId)
}

async function startPlayingStream(streamId, options = {}) {
	try {
		remoteStream = await zg.startPlayingStream(streamId, options);
		$('#playVideo')[0].srcObject = remoteStream;
		return true;
	} catch (err) {
		return false;
	}
}

async function stopPlayingStream(streamId) {
	zg.stopPlayingStream(streamId);
}
// uses SDK end


// ============================================================== 
// This part of the code binds the some  event
// ==============================================================  

$('#start').on('click', util.throttle( async function () {
  const RoomId = $('#RoomID').val();
  if(!RoomId) alert('RoomId is empty')
  const PublishId = $('#PublishID').val();
  if(!PublishId) alert('PublishId is empty')
  const PlayID = $('#PlayID').val();
  if(!PlayID) alert('PlayID is empty')

  this.classList.add('border-primary')
  if(!isStart) {
      //  Step1 loginRoom
      try {
        await loginRoom(RoomId, userID, userID)
        $('#roomStateSuccessSvg').css('display', 'inline-block')
        $('#roomStateErrorSvg').css('display', 'none')
      $('#RoomID')[0].disabled = true
      } catch (err) {
        $('#roomStateSuccessSvg').css('display', 'none')
        $('#roomStateErrorSvg').css('display', 'inline-block')
        this.classList.remove('border-primary');
        this.classList.add('border-error')
        this.innerText = 'Start Fail'
        return
      }

      // Step2 PublishingStream
      const flagPublish =  await startPublishingStream(PublishId);
      if(!flagPublish) {
        this.classList.remove('border-primary');
        this.classList.add('border-error')
        this.innerText = 'Start Fail'
        return
      }
      $('#PublishID')[0].disabled = true

      // Step3 PlayingStream
      const flagPlay =  await startPlayingStream(PlayID);
      if(!flagPlay) {
        this.classList.remove('border-primary');
        this.classList.add('border-error')
        this.innerText = 'Start Fail'
      } else {
        updateButton(this, 'Start', 'Stop');
        isStart = true
        $('#PlayID')[0].disabled = true
      }
      $('#customAudio')[0].play()
  } else {
      stopPlayingStream(PlayID)
      stopPublishingStream(PublishId);
      logoutRoom(roomID)
      updateButton(this, 'Start', 'Stop')
      isStart = false
      $('#RoomID')[0].disabled = false
      $('#PublishID')[0].disabled = false
      $('#PlayID')[0].disabled = false
      $('#roomStateSuccessSvg').css('display', 'none')
      $('#roomStateErrorSvg').css('display', 'inline-block')
      clearStream()
  }
}, 500))

// bind event end


// ============================================================== 
// This part of the code bias tool
// ============================================================== 

function updateButton(button, preText, afterText) {
  if (button.classList.contains('playing')) {
    button.classList.remove('paused', 'playing', 'border-error', 'border-primary');
    button.classList.add('paused');
    button.innerText = afterText
  } else {
    if (button.classList.contains('paused')) {
      button.classList.remove('border-error', 'border-primary');
      button.classList.add('playing');
      button.innerText = preText
    }
  }
  if (!button.classList.contains('paused')) {
    button.classList.remove('border-error', 'border-primary');
    button.classList.add('paused');
    button.innerText = afterText
  }
}

function checkVideo() {
  const timer = setTimeout(() => {
    resolve(false)
  }, 3000)
  return new Promise((resolve) => {
    $('#customLocalVideo').on('error', function() {
      resolve(false)
      clearTimeout(timer)
    })
    $('#customLocalVideo').on('loadeddata', function() {
      resolve(true)
      clearTimeout(timer)
    })
  })
}
// tool end

// ============================================================== 
// This part of the code Initialization web page
// ============================================================== 
async function render() {
  $('#roomInfo-id').text(roomID)
  $('#RoomID').val(roomID)
  $('#UserName').val(userID)
  $('#UserID').val(userID)
  $('#PublishID').val(streamID)
  $('#PlayID').val(streamID)
  createZegoExpressEngine()
  await checkSystemRequirements()
  enumDevices()
  initEvent()
  setLogConfig()
}

render()

// Initialization end