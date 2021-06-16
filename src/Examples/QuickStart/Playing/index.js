// require('../../../../jquery')
// let appID = 1739272706;   // from  /src/KeyCenter.js
// let server = 'wss://webliveroom-test.zego.im/ws';  // from  /src/KeyCenter.js
// let tokenUrl = 'https://wsliveroom-demo.zego.im:8282/token';  // from  /src/KeyCenter.js

// ==============================================================
// This part of the code defines the default values and global values
// ==============================================================

let userID = Util.getBrow() + '_' + new Date().getTime();
let roomID = '0003';
let streamID = '0003';

let zg = null;
let remoteStream = null;
let isLogin = false;
let played = false;

// part end

// ==============================================================
// This part of the code uses the SDK
// ==============================================================

function initEvent() {
	zg.on('roomStateUpdate', (roomId, state) => {
		if (state === 'CONNECTED' && isLogin) {
			console.log(111);
			$('#roomStateSuccessSvg').css('display', 'inline-block');
			$('#roomStateErrorSvg').css('display', 'none');
		}

		if (state === 'DISCONNECTED' && !isLogin) {
			$('#roomStateSuccessSvg').css('display', 'none');
			$('#roomStateErrorSvg').css('display', 'inline-block');
		}

		if (state === 'DISCONNECTED' && isLogin) {
			location.reload()
		}
	})

	zg.on('playerStateUpdate', (result) => {
		if (result.state === 'PLAYING') {
			$('#playInfo-id').text(result.streamID);
		} else if (result.state === 'NO_PLAY') {
			$('#playInfo-id').text('');
		}
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

//  Create ZegoExpressEngine
function createZegoExpressEngine() {
	zg = new ZegoExpressEngine(appID, server);
	window.zg = zg;
}

//  Check system requirements
async function checkSystemRequirements() {
	console.log('sdk version is', zg.getVersion());
	try {
		const result = await zg.checkSystemRequirements();

		console.warn('checkSystemRequirements ', result);

		if (!result.webRTC) {
			console.log('browser is not support webrtc!!');
			return false;
		} else if (!result.videoCodec.H264 && !result.videoCodec.VP8) {
			console.log('browser is not support H264 and VP8');
			return false;
		} else if (result.videoCodec.H264) {
			if (!result.screenSharing) console.log('browser is not support screenSharing');
		} else {
			console.log('不支持H264，请前往混流转码测试');
		}

		return true;
	} catch (err) {
		console.error('checkSystemRequirements', err);
		return false;
	}
}

//  Login room
function loginRoom(roomId, userId, userName) {
	return new Promise((resolve, reject) => {
		// Need to get the token before logging in to the room
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

// Logout room
function logoutRoom(roomId) {
	remoteStream && stopPlayingStream($('#PlayID').val());
	zg.logoutRoom(roomId);
	clearStream()
}

//  Start Play Stream
async function startPlayingStream(streamId, options = {}) {
	try {
		remoteStream = await zg.startPlayingStream(streamId, options);
		$('#playVideo')[0].srcObject = remoteStream;
		return true;
	} catch (err) {
		return false;
	}
}

//  Stop Play Stream
async function stopPlayingStream(streamId) {
	zg.stopPlayingStream(streamId);
	clearStream();
}

function clearStream() {
	remoteStream && zg.destroyStream(remoteStream);
	$('#playVideo')[0].pause()
	$('#playVideo')[0].srcObject = null;
	remoteStream = null;
	played = false
}

// uses SDK end

// ==============================================================
// This part of the code binds the button click event and change event
// ==============================================================

$('#LoginRoom').on(
	'click',
	util.throttle(async function () {

		const userName = $('#UserName').val();
		const id = $('#RoomID').val();

		if (!userName) return alert('UserName is Empty');
		if (!id) return alert('RoomID is Empty');
		this.classList.add('border-primary');
		if (!isLogin) {
			try {
				isLogin = true;
				await loginRoom(id, userID, userName);
				updateButton(this, 'Login Room', 'Logout Room');
				$('#UserName')[0].disabled = true;
				$('#RoomID')[0].disabled = true;
			} catch (err) {
				isLogin = false;
				this.classList.remove('border-primary');
				this.classList.add('border-error');
				this.innerText = 'Login Fail Try Again';
			}
		} else {
			if (remoteStream) {
				$('#PlayID')[0].disabled = false;
				updateButton($('#startPlaying')[0], 'Start Playing', 'Stop Playing');
			}
			isLogin = false;
			logoutRoom(id);
			updateButton(this, 'Login Room', 'Logout Room');
			$('#UserName')[0].disabled = false;
			$('#RoomID')[0].disabled = false;
		}
	}, 500)
);

$('#startPlaying').on(
	'click',
	util.throttle(async function () {
		if (!isLogin) return alert('should login room');

		const id = $('#PlayID').val();
		if (!id) return alert('StreamID is Empty');
		this.classList.add('border-primary');
		if (!played) {
			const config = {
				video: $('#Video')[0].checked ? undefined : false,
				audio: $('#Audio')[0].checked
			};
			const flag = await startPlayingStream(id, config);
			if (flag) {
				updateButton(this, 'Start Playing', 'Stop Playing');
				played = true;
				$('#PlayID')[0].disabled = true;
				$('#Video')[0].disabled = true;
				$('#Audio')[0].disabled = true;
			} else {
				this.classList.remove('border-primary');
				this.classList.add('border-error');
				this.innerText = 'Playing Fail Try Again';
			}
		} else {
			stopPlayingStream($('#PlayID').val());
			updateButton(this, 'Start Playing', 'Stop Playing');
			played = false;
			$('#PlayID')[0].disabled = false;
			$('#Video')[0].disabled = false;
			$('#Audio')[0].disabled = false;
		}
	}, 500)
);
// bind event end

// ==============================================================
// This part of the code bias tool
// ==============================================================

function updateButton(button, preText, afterText) {
	if (button.classList.contains('playing')) {
		button.classList.remove('paused', 'playing', 'border-error', 'border-primary');
		button.classList.add('paused');
		button.innerText = afterText;
	} else {
		if (button.classList.contains('paused')) {
			button.classList.remove('border-error', 'border-primary');
			button.classList.add('playing');
			button.innerText = preText;
		}
	}
	if (!button.classList.contains('paused')) {
		button.classList.remove('border-error', 'border-primary');
		button.classList.add('paused');
		button.innerText = afterText;
	}
}

// tool end

// ==============================================================
// This part of the code Initialization web page
// ==============================================================

async function render() {
	$('#roomInfo-id').text(roomID);
	$('#RoomID').val(roomID);
	$('#UserName').val(userID);
	$('#PlayID').val(streamID);
	$('#Video')[0].checked = true;
	createZegoExpressEngine();
	await checkSystemRequirements();
	initEvent();
	setLogConfig();
}

render();

// Initialization end
