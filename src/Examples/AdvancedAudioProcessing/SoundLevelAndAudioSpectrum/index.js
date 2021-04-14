// require('../../../../jquery')
// let appID;   // from  /src/KeyCenter.js
// let server;  // from  /src/KeyCenter.js
// let tokenUrl;  // from  /src/KeyCenter.js

// ==============================================================
// This part of the code defines the default values and global values
// ==============================================================

let userID = Util.getBrow() + '_' + new Date().getTime();
let roomID = '0018';
let streamID = '0018';

let zg = null;
let localStream = null;
let remoteStream = null;

// part end

// ==============================================================
// This part of the code uses the SDK
// ==============================================================

function createZegoExpressEngine() {
	zg = new ZegoExpressEngine(appID, server);
	window.zg = zg;
}

async function checkSystemRequirements() {
	console.log('sdk version is', zg.getVersion());
	try {
		const result = await zg.checkSystemRequirements();

		console.warn('checkSystemRequirements ', result);
		!result.videoCodec.H264 && $('#videoCodeType option:eq(1)').attr('disabled', 'disabled');
		!result.videoCodec.VP8 && $('#videoCodeType option:eq(2)').attr('disabled', 'disabled');

		if (!result.microphone) {
			alert('Microphone does not have permission');
		}

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

// init SDK Event
function initEvent() {
	zg.on('publisherStateUpdate', (result) => {
		console.log('publisherStateUpdate', result);
	});

	zg.on('playerStateUpdate', (result) => {
		console.log('playerStateUpdate', result);
	});

	zg.on('publishQualityUpdate', (streamId, stats) => {
		console.log('publishQualityUpdate', streamId, stats);
	});

	zg.on('playQualityUpdate', (streamId, stats) => {
		console.log('playQualityUpdate', streamId, stats);
	});

	zg.on('soundLevelUpdate', (streamList) => {
		streamList.forEach((stream) => {
      if(stream.streamID === streamID) {
        const value = Math.round(stream.soundLevel)
        $('#SoundLevelProgressbar').progressbar(value)
      }
		});
	});
}

function setLogConfig() {
	let config = localStorage.getItem('logConfig');
	const DebugVerbose = localStorage.getItem('DebugVerbose') === 'true' ? true : false;
	if (config) {
		config = JSON.parse(config);
		zg.setLogConfig({
			logLevel: config.logLevel,
			remoteLogLevel: config.remoteLogLevel,
			logURL: ''
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
					resolve();
				} catch (err) {
					reject();
				}
			}
		);
	});
}

async function startPublishingStream(streamId, config) {
	try {
		localStream = await zg.createStream(config);
		zg.startPublishingStream(streamId, localStream);
		$('#pubshlishVideo')[0].srcObject = localStream;
		return true;
	} catch (err) {
		return false;
	}
}

function startSoundLevelDelegate(time) {
  zg.setSoundLevelDelegate(true, time);
}

function stopSoundLevelDelegate() {
  zg.setSoundLevelDelegate(false);
}

// uses SDK end

// ==============================================================
// This part of the code bind checkbox change event
// ==============================================================

$('#SoundLevelMonitor').on('change', function({ target }) {
	if (target.checked) {
		startSoundLevelDelegate(500)
	} else {
    stopSoundLevelDelegate()
		$('#SoundLevelProgressbar').progressbar(0)
	}
});

// bind event end

// ==============================================================
// This part of the code bias tool
// ==============================================================

function getCreateStreamConfig() {
	const config = { camera: { video: false } };
	return config;
}

// tool end

// ==============================================================
// PROGRESSBAR CLASS DEFINITION
// ==============================================================

const Progressbar = function(element) {
	this.$element = $(element);
};

Progressbar.prototype.update = function(value) {
	var $div = this.$element.find('div');
	var $span = $div.find('span');
	$div.attr('aria-valuenow', value);
	$div.css('width', value + '%');
	$span.text(value + '% Complete');
};

// PROGRESSBAR PLUGIN DEFINITION
$.fn.progressbar = function(option) {
	return this.each(function() {
		var $this = $(this),
			data = $this.data('jbl.progressbar');

		if (!data) $this.data('jbl.progressbar', (data = new Progressbar(this)));
		if (typeof option == 'string') data[option]();
		if (typeof option == 'number') data.update(option);
	});
};

// class defintion end

// ==============================================================
// This part of the code Initialization web page
// ==============================================================

async function render() {
	$('#roomInfo-id').text(roomID);
	$('#RoomID').val(roomID);
	createZegoExpressEngine();
	await checkSystemRequirements();
	enumDevices();
	initEvent();
	setLogConfig();
	try {
		await loginRoom(roomID, userID, userID);
		$('#roomStateSuccessSvg').css('display', 'inline-block');
		$('#roomStateErrorSvg').css('display', 'none');
	} catch (err) {
		$('#roomStateSuccessSvg').css('display', 'none');
		$('#roomStateErrorSvg').css('display', 'inline-block');
	}
	await startPublishingStream(streamID, getCreateStreamConfig());
}

render();

// Initialization end
