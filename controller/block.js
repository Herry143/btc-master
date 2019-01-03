const lib = require('bitcore-lib');
const node = require("../lib/bitcore-node");

exports.getTxs = function(req, res) {
    var block = req.params.block;
    if (!checkBlockParam(block)) {
        res.status(400).json({ "error": "Expected block hash or block number, but got:" + block });
        return;
    }
    var address = req.params.address;
    if (address && !lib.Address.isValid(address, 'livenet')) {
        res.status(400).json({"error":"'address' isn't a valid livenet's address"});
        return;
    }
    if (address) {
        node.services.bitcoind.getBlockHeader(block, (err, scope) => {
            if (err) {
                res.status(400).json({"error": err.toString()});
                return;
            }
            block = scope.height;
            var opt = {"start":block, "end":block};
            node.services.bitcoind.getAddressHistory(address, opt, (err, summary) => {
                if (err) {
                    res.status(400).json({"error": err.toString()});
                    return;
                }
                var ret = [];
                summary.items.forEach(item => {
                    var inputs = [];
                    var outputs = [];
                    item.tx.inputs.forEach(input => {
                        inputs.push({"address":input.address, "value":input.satoshis.toString()});
                    });
                    item.tx.outputs.forEach(output => {
                        outputs.push({"address":output.address, "value":output.satoshis.toString()});
                    });
                    //ret.push({"from":inputs, "to":outputs, "timestamp":item.tx.blockTimestamp, "hash":item.tx.hash, "receive":item.satoshis});
                    ret.push(item.tx.hash);
                });
                res.json({
                    blockNumber: scope.height.toString(), 
                    blockHash: scope.hash,
                    confirmations: scope.confirmations.toString(),
                    timestamp: scope.time.toString(),
                    transactions: ret
                });
            });
        })
    } else {
        node.services.bitcoind.getBlockOverview(block, (err, scope) => {
            if (err) {
                res.status(400).json({"error": err.toString()});
                return;
            }
            res.json({
                blockNumber: scope.height.toString(), 
                blockHash: scope.hash,
                confirmations: scope.confirmations.toString(),
                timestamp: scope.time.toString(),
                transactions: scope.txids
            });
        });
    }
}

function checkBlockParam(block) {
    if (/^0x[0-9a-fA-F]{64}$/.test(block) || /[0-9]+/.test(block)) {
        return true;
    }
    return false;
}