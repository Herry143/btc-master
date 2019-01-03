var bitcore = require('bitcore-node');

var Bitcoin = bitcore.services.Bitcoin;
var node = new bitcore.Node({
    network: 'livenet',
    services: [
        {
            name: 'bitcoind',
            module: Bitcoin,
            config: {
                connect: [{
                    "rpchost": "129.204.128.159",
                    "rpcport": 80,
                    "rpcuser": "test",
                    "rpcpassword": "test",
                    "zmqpubrawtx": "tcp://127.0.0.1:28332"
                }]
            }
        }
    ]
});
module.exports = node;