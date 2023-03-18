const express = require('express');
const app = express();
const http = require('http');
const mediasoup = require('mediasoup');

// Middleware to parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({
	extended: true
}));

let worker; // Variable to store the mediasoup worker
let router; // Variable to store the mediasoup router
let webRtcTransport; // Variable to store the mediasoup WebRTC transport

// Create an HTTP server using the Express app
const server = http.createServer(app);

// Listen on port 3000
server.listen(3000, () => {
	console.log(`Express server listening on port ${server.address().port}`);
});

// Create a mediasoup worker
mediasoup.createWorker().then((mediasoupWorker) => {
	worker = mediasoupWorker;
});

// Handle mediasoup requests
app.post('/mediasoup', async (req, res) => {
	// If the mediasoup worker has not been initialized yet, return an error
	if (!worker) {
		res.status(500).send('Mediasoup worker not initialized');
		return;
	}

	// If the router has not been created yet, create it now
	if (!router) {
		router = await worker.createRouter({
			mediaCodecs: [{
					kind: 'audio',
					mimeType: 'audio/opus',
					clockRate: 48000,
					channels: 2
				},
				{
					kind: 'video',
					mimeType: 'video/VP8',
					clockRate: 90000,
					parameters: {
						'x-google-start-bitrate': 1000
					}
				}
			]
		});
	}

	// Handle the different mediasoup methods
  
switch (req.body.method) {

    case 'queryRouterRtpCapabilities':
      // Return the router's RTP capabilities
      const rtpCapabilities = router.rtpCapabilities;
      res.send(rtpCapabilities);
      break;

    case 'createWebRtcTransport':
      // Create a WebRTC transport
      webRtcTransport = await router.createWebRtcTransport({
        listenIps: [{
          ip: '0.0.0.0',
          announcedIp: null
        }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate: 1000000
      });

	  // Return the transport parameters
		const {
			id,
			iceParameters,
			iceCandidates,
			dtlsParameters
		} = webRtcTransport;
		res.send({
			id,
			iceParameters,
			iceCandidates,
			dtlsParameters
		});
		break;

    case 'connectTransport':
        // Connect the WebRTC transport
  if (!webRtcTransport) {
    res.status(500).send('WebRTC transport not initialized');
	initwebRtcTransport();
	return;
  }
  try {
    await webRtcTransport.connect({ dtlsParameters: req.body.data.dtlsParameters });
    res.send({ connected: true });
	console.log('connected');
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }

    case 'produce':
      // Produce a mediasoup stream
		const {
			kind,
			rtpParameters
		} = req.body.data;
		const producer = await webRtcTransport.produce({
			kind,
			rtpParameters
		});
		res.send({
			id: producer.id
		});
      break;

    default:
      // If the requested method is not found, return a 404 error
      res.status(404).send('Not found');
      break;
  }

});