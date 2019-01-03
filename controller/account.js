const lib = require('bitcore-lib');
const node = require("../lib/bitcore-node");
const async = require("async");
const cw = require("../lib/cw");

exports.create = function(req, res) {
    if (req.protocol !== "https") {
        return res.status(403).json({error: "must use https"});
    }
    var priv = new lib.PrivateKey();
    var address = priv.toAddress();
    let ansa = req.body.ansa;
    let ansb = req.body.ansb;
    let ansc = req.body.ansc;
    let time = req.body.time;
    if (!ansa || !ansb || !ansc || !time) {
        return res.status(400).json({error: "ansa, ansb, ansc, time required"});
    }
    let enc = cw.encode(ansa, ansb, ansc, time, priv.toString());
    res.json({ "address": address.toString(), "enc": enc });
}

exports.check = function(req, res) {
    let addr = req.params.address;
    return res.json({
        result: lib.Address.isValid(addr, 'livenet')
    });
}

exports.recover = function(req, res) {
    if (req.protocol !== "https") {
        return res.status(403).json({error: "must use https"});
    }
    let priv = req.body.priv;
    let ansa = req.body.ansa;
    let ansb = req.body.ansb;
    let ansc = req.body.ansc;
    let time = req.body.time;
    if (!lib.PrivateKey.isValid(priv)) {
        res.status(400).json({"error":"privateKey is invalid"});
        return;
    }
    if (!ansa || !ansb || !ansc || !time) {
        return res.status(400).json({error: "ansa, ansb, ansc, time required"});
    }
    var privateKey = new lib.PrivateKey(priv);
    var address = privateKey.toAddress();
    let enc = cw.encode(ansa, ansb, ansc, time, priv);
    res.json({"address":address.toString(), "enc":enc});
}

exports.dump = function(req, res) {
    if (req.protocol !== "https") {
        return res.status(403).json({ error: "must use https" });
    }
    let ansa = req.body.ansa;
    let ansb = req.body.ansb;
    let ansc = req.body.ansc;
    let time = req.body.time;
    let enc = req.body.enc;
    if (!ansa || !ansb || !ansc || !time || !enc) {
        return res.status(400).json({error: "ansa, ansb, ansc, time, enc required"});
    }
    let priv = cw.decode(ansa, ansb, ansc, time, enc);
    return res.json({"privateKey": priv});
}

exports.getBalance = function(req, res) {
    var address = req.params.address;
    var testnet = req.query.testnet;
    if (testnet) {
        if (!lib.Address.isValid(address, 'testnet')) {
            res.status(400).json({"error":"address isn't a valid testnet's address"});
            return;
        }
    } else {
        if (!lib.Address.isValid(address, 'livenet')) {
            res.status(400).json({"error":"address isn't a valid livenet's address"});
            return;
        }
    }
    node.services.bitcoind.getAddressBalance(address, {}, (err, balance) => {
        if (err) {
            res.status(400).json({"error": err.toString()});
            return;
        }
        res.json({"address":address, "balance":balance.balance.toString()});
    });
}

exports.getBalances = function (req, res) {
    let addrs = req.body.addrs;
    if (!(addrs instanceof Array)) {
        return res.status(400).json({ error: "addrs should be a array" });
    }
    for (let addr of addrs) {
        if (!lib.Address.isValid(addr, 'livenet')) {
            return res.status(400).json({"error":`addrs(${addr}) invalid`});
        }
    }
    let ret = [];
    async.forEachOf(addrs, (addr, id, cb) => {
        node.services.bitcoind.getAddressBalance(addr, {}, (err, balance) => {
            if (err) {
                cb(err)
            }
            ret.push({
                address: addr,
                balance: balance.balance.toString()
            });
            cb();
        });
    }, err => {
        if (err) {
            res.status(400).json({"error": err.toString()});
            return;
        }
        return res.json(ret);
    });
}

exports.getHistory = function(req, res) {
    var address = req.params.address;
    if (!lib.Address.isValid(address, 'livenet')) {
        res.status(400).json({"error":"address isn't a valid livenet's address"});
        return;
    }
    var page = req.query.page;
    var pagesize = req.query.pagesize;
    if (!page || page == "0") {
        page = 1;
    } else {
        if (!/^[1-9][0-9]*$/.test(page)) {
            res.status(400).json({"error":"page invalid"});
            return;
        } 
        page = new Number(page);
    }
    if (!pagesize || pagesize == "0") {
        pagesize = 10;
    } else {
        if (!/^[1-9][0-9]*$/.test(pagesize)) {
            res.status(400).json({"error":"pagesize invalid"});
            return;
        } 
        pagesize = new Number(pagesize);
    }
    var from = (page - 1) * pagesize;
    var to = from + pagesize;
    var opt = {"from":from, "to":to};
    node.services.bitcoind.getAddressSummary(address, opt, (err, summary) => {
        if (err) {
            res.status(400).json({"error":err.toString()});
            return;
        }
        res.json({"address":address, "transactions":summary.txids});
    });
}

exports.getHistoryDetail = function(req, res) {
    var address = req.params.address;
    if (!lib.Address.isValid(address, 'livenet')) {
        res.status(400).json({"error":"address isn't a valid livenet's address"});
        return;
    }
    var page = req.query.page;
    var pagesize = req.query.pagesize;
    if (!page || page == "0") {
        page = 1;
    } else {
        if (!/^[1-9][0-9]*$/.test(page)) {
            res.status(400).json({"error":"page invalid"});
            return;
        } 
        page = new Number(page);
    }
    if (!pagesize || pagesize == "0") {
        pagesize = 10;
    } else {
        if (!/^[1-9][0-9]*$/.test(pagesize)) {
            res.status(400).json({"error":"pagesize invalid"});
            return;
        } 
        pagesize = new Number(pagesize);
    }
    var from = (page - 1) * pagesize;
    var to = from + pagesize;
    var opt = {"from":from, "to":to, "noTxList":false};
    node.services.bitcoind.getAddressHistory(address, opt, (err, summary) => {
        if (err) {
            res.status(400).json({"error":err.toString()});
            return;
        }
        var ret = [];
        summary.items.forEach(item => {
            var inputs = [];
            var outputs = [];
            item.tx.inputs.forEach(input => {
                inputs.push({"address":input.address, "value":input.satoshis ? input.satoshis.toString() : "0"});
            });
            item.tx.outputs.forEach(output => {
                outputs.push({"address":output.address, "value":output.satoshis ? output.satoshis.toString() : "0"});
            });
            ret.push({"from":inputs, "to":outputs, "timestamp":item.tx.blockTimestamp.toString(), "hash":item.tx.hash, "receive":item.satoshis.toString()});
        });
        res.json({"address":address, "transactions":ret});
    });
}