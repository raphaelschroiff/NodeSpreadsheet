exports.RT_SERVER_HOST = 'http://localhost'; //the ip/hostname under which the client will access the RT-Server
//exports.RT_SERVER_PORT = process.env.PORT;
exports.RT_SERVER_PORT = 8000;
exports.PING_TIMEOUT = 20; //timeout (in seconds) after which clients will be disconnected if they dont send the "alive"-ping