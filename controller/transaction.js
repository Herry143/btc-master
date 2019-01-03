'use strict';

const lib = require('bitcore-lib');
const node = require("../lib/bitcore-node");
const db = require("../lib/leveldb");
const logger = require("../lib/logger");
const cw = require("../lib/cw");

exports.send = async function(req, res) {
    if (req.protocol !== "https") {
        return res.status(403).json({error: "must use https"});
    }
    // var priv = req.body.privateKey;
    // if (!lib.PrivateKey.isValid(priv)) {
    //     res.status(400).json({error:"privateKey is invalid"});
    //     return;
    // }
    var amount = req.body.amount;
    var to = req.body.to;
    var fee = req.body.fee;
    var uuid = req.body.uuid;
    if (uuid === undefined || typeof(uuid) != 'string') {
        res.status(400).json({ "error": "uuid invalid" });
        return;
    }
    if (!amount || !to || !fee) {
        res.status(400).json({"error":"'amount', 'to', 'fee' are required"});
        return;
    }
    if (!lib.Address.isValid(to, 'livenet')) {
        res.status(400).json({"error":"'to' isn't a valid livenet's address"});
        return;
    }
    if (typeof(amount) != "string") {
        res.status(400).json({"error":"'amount' must be string"});
        return;
    }
    if (!/^[0-9]+$/.test(amount)) {
        res.status(400).json({"error":"'amount' invalid"});
        return;
    }
    if (typeof(fee) != "string") {
        res.status(400).json({"error":"'fee' must be string"});
        return;
    }
    if (!/^[0-9]+$/.test(fee)) {
        res.status(400).json({"error":"'fee' invalid"});
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
    if (!lib.PrivateKey.isValid(priv)) {
        return res.status(400).json({error: "recover privateKey faild"});
    }
    var existingTx = await db.get(uuid).catch(err => {
        if (err.notFound) {
            return undefined;
        } else {
            return {srvErr: err}
        }
    });
    if (existingTx !== undefined) {
        if (existingTx.srvErr) {
            res.status(500).json({ error: "levelDB error: " + existingTx.srvErr.toString() });
            logger.error("get uuid error: %s", existingTx.srvErr);
            return;
        } else {
            res.json({ "transactionHash": existingTx });
            logger.warn("Repeat submitting a transaction\n\tuuid:%s\n\ttxhash:%s\n\tip:%s", uuid, existingTx, req.ip)
            return;
        }
    }
    amount = lib.Unit.fromSatoshis(amount).satoshis;
    fee = lib.Unit.fromSatoshis(fee).satoshis;
    var privateKey = new lib.PrivateKey(priv);
    var address = privateKey.toAddress().toString();
    node.services.bitcoind.getAddressUnspentOutputs(address, {}, (err, utxos) => {
        if (err) {
            res.status(400).json({"error":"can not get address's utxo"});
            return;
        }
        var bitcore_trans = new lib.Transaction()
            .from(utxos)
            .to(to, amount)
            .change(address)
            .fee(fee)
            .sign(privateKey);
        var serializeError = bitcore_trans.getSerializationError();
        if (serializeError) {
            res.status(400).json({"error":"sign transaction failed"});
            logger.error("signTransaction: %s", serializeError);
            return;
        }
        var transaction_hex = bitcore_trans.serialize();
        node.services.bitcoind.sendTransaction(transaction_hex, (err, txid) => {
            if (err) {
                res.status(400).json({"error":"send transaction failed"});
                logger.error("sendTransaction: %s", err);
                return;
            }
            logger.warn("send transaction success(via %s): %s", req.ip, pretty({
                from: address,
                to: to,
                amount: amount,
                fee: fee,
                txid: txid,
                uuid: uuid
            }));
            res.json({"txid": txid});
            db.put(uuid, txid, (err) => {
                if (err) {
                    logger.error("put uuid error: %s", err);
                }
            })
        });
    });
}
function pretty(obj) {
    return JSON.stringify(obj, null, 2);
}
exports.sendraw = function(req, res) {
    var raw = req.params.raw;
    node.services.bitcoind.sendTransaction(raw, (err, txid) => {
        if (err) {
            res.status(400).json({"error":err.toString()});
            return;
        }
        res.json({"txid":txid});
    });
}

exports.getInfo = function(req, res) {
    var hash = req.params.hash;
    node.services.bitcoind.getDetailedTransaction(hash, (err, tx) => {
        if (err) {
            res.status(400).json({"error":err.toString()});
            return;
        }
        if (!tx) {
            res.status(400).json({"error": "transaction not found"});
            return;
        }
        var from = [];
        var to = [];
        tx.inputs.forEach(item => {
            from.push({address: item.address, value:item.satoshis.toString()});
        });
        tx.outputs.forEach(item => {
            to.push({address: item.address, value: item.satoshis.toString()});
        })
        res.json({
            blockHash: tx.blockHash,
            blockNumber: tx.height.toString(),
            from: from,
            to: to,
            fee: tx.feeSatoshis.toString(),
            timestamp: tx.blockTimestamp.toString()
        });
    })
}

exports.confirmation = function(req, res) {
    var hash = req.params.hash;
    node.services.bitcoind.getDetailedTransaction(hash, (err, tx) => {
        if (err) {
            res.status(400).json({"error": err.toString()});
            return;
        }
        node.services.bitcoind.getInfo((err, info) => {
            if (err) {
                res.status(400).json({"error":err.toString()});
                return;
            }
            res.json({"number":(info.blocks - tx.height).toString()})
        });
    });
}

exports.getFee = function(req, res) {
    node.services.bitcoind.estimateFee(3, (err, fee) => {
        if (err) {
            res.status(400).json({"error":"something wrong when get estimate fee"});
            return;
        }
        res.json({"fee": lib.Unit.fromBTC(fee).toSatoshis().toString()});
    })
}

exports.sendTest = async function(req, res) {
    if (req.protocol !== "https") {
        return res.status(403).json({error: "must use https"});
    }
    var amount = req.body.amount;
    var to = req.body.to;
    var fee = req.body.fee;
    var uuid = req.body.uuid;
    if (uuid === undefined || typeof(uuid) != 'string') {
        res.status(400).json({ "error": "uuid invalid" });
        return;
    }
    if (!amount || !to || !fee) {
        res.status(400).json({"error":"'amount', 'to', 'fee' are required"});
        return;
    }
    if (!lib.Address.isValid(to, 'livenet')) {
        res.status(400).json({"error":"'to' isn't a valid livenet's address"});
        return;
    }
    if (typeof(amount) != "string") {
        res.status(400).json({"error":"'amount' must be string"});
        return;
    }
    if (!/^[0-9]+$/.test(amount)) {
        res.status(400).json({"error":"'amount' invalid"});
        return;
    }
    if (typeof(fee) != "string") {
        res.status(400).json({"error":"'fee' must be string"});
        return;
    }
    if (!/^[0-9]+$/.test(fee)) {
        res.status(400).json({"error":"'fee' invalid"});
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
    if (!lib.PrivateKey.isValid(priv)) {
        return res.status(400).json({error: "recover privateKey faild"});
    }
    var existingTx = await db.get(uuid).catch(err => {
        if (err.notFound) {
            return undefined;
        } else {
            return {srvErr: err}
        }
    });
    if (existingTx !== undefined) {
        if (existingTx.srvErr) {
            res.status(500).json({ error: "levelDB error: " + existingTx.srvErr.toString() });
            logger.error("get uuid error: %s", existingTx.srvErr);
            return;
        } else {
            res.json({ "transactionHash": existingTx });
            logger.warn("Repeat submitting a transaction\n\tuuid:%s\n\ttxhash:%s\n\tip:%s", uuid, existingTx, req.ip)
            return;
        }
    }
    amount = lib.Unit.fromSatoshis(amount).satoshis;
    fee = lib.Unit.fromSatoshis(fee).satoshis;
    var privateKey = new lib.PrivateKey(priv);
    var address = privateKey.toAddress().toString();
    node.services.bitcoind.getAddressUnspentOutputs(address, {}, (err, utxos) => {
        if (err) {
            res.status(400).json({"error":"can not get address's utxo"});
            return;
        }
        var bitcore_trans = new lib.Transaction()
            .from(utxos)
            .to(to, amount)
            .change(address)
            .fee(fee)
            .sign(privateKey);
        var serializeError = bitcore_trans.getSerializationError();
        if (serializeError) {
            res.status(400).json({"error":"sign transaction failed"});
            logger.error("signTransaction: %s", serializeError);
            return;
        }
        var transaction_hex = bitcore_trans.serialize();
        var txid = lib.crypto.Hash.sha256(Buffer.from(transaction_hex, 'hex')).toString('hex')
        logger.warn("send transaction success(via %s): %s", req.ip, pretty({
            from: address,
            to: to,
            amount: amount,
            fee: fee,
            txid: txid,
            uuid: uuid
        }));
        res.json({ "txid": txid });
        db.put(uuid, txid, (err) => {
            if (err) {
                logger.error("put uuid error: %s", err);
            }
        })
    });
}

exports.sendMultiple = async function(req, res) {
    if (req.protocol !== "https") {
        return res.status(403).json({error: "must use https"});
    }
    var amounts = req.body.amounts;
    var tos = req.body.tos;
    var uuid = req.body.uuid;
    if (uuid === undefined || typeof(uuid) != 'string') {
        res.status(400).json({ "error": "uuid invalid" });
        return;
    }
    if (!(amounts instanceof Array) || !(tos instanceof Array)) {
        return res.status(400).json({ error: "amounts and tos must be array" })
    }
    if (amounts.length !== tos.length || amounts.length == 0) {
        return res.status(400).json({ error: "amounts and tos length not match or equals 0" })
    }
    for (let i = 0; i < amounts.length; i++) {
        if (!lib.Address.isValid(tos[i], 'livenet')) {
            res.status(400).json({"error":`to(${tos[i]}) isn't a valid livenet's address`});
            return;
        }
        if (typeof(amounts[i]) != "string") {
            res.status(400).json({"error":`amount(${amounts[i]},type:${typeof(amounts[i])}) must be string`});
            return;
        }
        if (!/^[0-9]+$/.test(amounts[i])) {
            res.status(400).json({"error":`amount(${amounts[i]}) invalid`});
            return;
        }
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
    if (!lib.PrivateKey.isValid(priv)) {
        return res.status(400).json({error: "recover privateKey faild"});
    }

    var existingTx = await db.get(uuid).catch(err => {
        if (err.notFound) {
            return undefined;
        } else {
            return {srvErr: err}
        }
    });
    if (existingTx !== undefined) {
        if (existingTx.srvErr) {
            res.status(500).json({ error: "levelDB error: " + existingTx.srvErr.toString() });
            logger.error("get uuid error: %s", existingTx.srvErr);
            return;
        } else {
            res.json({ "transactionHash": existingTx });
            logger.warn("Repeat submitting a transaction\n\tuuid:%s\n\ttxhash:%s\n\tip:%s", uuid, existingTx, req.ip)
            return;
        }
    }
    // amount = lib.Unit.fromSatoshis(amount).satoshis;
    // fee = lib.Unit.fromSatoshis(fee).satoshis;
    var privateKey = new lib.PrivateKey(priv);
    var address = privateKey.toAddress().toString();
    node.services.bitcoind.getAddressUnspentOutputs(address, {}, (err, utxos) => {
        if (err) {
            res.status(400).json({"error":"can not get address's utxo"});
            return;
        }
        var bitcore_trans = new lib.Transaction().from(utxos);
        for (let i = 0; i < tos.length; i++) {
            bitcore_trans = bitcore_trans.to(tos[i], lib.Unit.fromSatoshis(amounts[i]).satoshis);
        }
        bitcore_trans = bitcore_trans.change(address);
        let fee = bitcore_trans._estimateFee();
        bitcore_trans = bitcore_trans.fee(fee).sign(privateKey);
        var serializeError = bitcore_trans.getSerializationError();
        if (serializeError) {
            res.status(400).json({"error":"sign transaction failed"});
            logger.error("signTransaction: %s", serializeError);
            return;
        }
        var transaction_hex = bitcore_trans.serialize();
        node.services.bitcoind.sendTransaction(transaction_hex, (err, txid) => {
            if (err) {
                res.status(400).json({"error":"send transaction failed"});
                logger.error("sendTransaction: %s", err);
                return;
            }
            logger.warn("send transaction success(via %s): %s", req.ip, pretty({
                from: address,
                to: tos,
                amount: amounts,
                fee: fee,
                txid: txid,
                uuid: uuid
            }));
            res.json({"txid": txid});
            db.put(uuid, txid, (err) => {
                if (err) {
                    logger.error("put uuid error: %s", err);
                }
            })
        });
    });
}
exports.sendAdmin = async function(req, res) {
    if (req.protocol !== "https") {
        return res.status(403).json({error: "must use https"});
    }
    var priv = req.body.privateKey;
    if (!lib.PrivateKey.isValid(priv)) {
        res.status(400).json({error:"privateKey is invalid"});
        return;
    }
    var amount = req.body.amount;
    var to = req.body.to;
    var fee = req.body.fee;
    var uuid = req.body.uuid;
    if (uuid === undefined || typeof(uuid) != 'string') {
        res.status(400).json({ "error": "uuid invalid" });
        return;
    }
    if (!amount || !to || !fee) {
        res.status(400).json({"error":"'amount', 'to', 'fee' are required"});
        return;
    }
    if (!lib.Address.isValid(to, 'livenet')) {
        res.status(400).json({"error":"'to' isn't a valid livenet's address"});
        return;
    }
    if (typeof(amount) != "string") {
        res.status(400).json({"error":"'amount' must be string"});
        return;
    }
    if (!/^[0-9]+$/.test(amount)) {
        res.status(400).json({"error":"'amount' invalid"});
        return;
    }
    if (typeof(fee) != "string") {
        res.status(400).json({"error":"'fee' must be string"});
        return;
    }
    if (!/^[0-9]+$/.test(fee)) {
        res.status(400).json({"error":"'fee' invalid"});
    }
    var existingTx = await db.get(uuid).catch(err => {
        if (err.notFound) {
            return undefined;
        } else {
            return {srvErr: err}
        }
    });
    if (existingTx !== undefined) {
        if (existingTx.srvErr) {
            res.status(500).json({ error: "levelDB error: " + existingTx.srvErr.toString() });
            logger.error("get uuid error: %s", existingTx.srvErr);
            return;
        } else {
            res.json({ "transactionHash": existingTx });
            logger.warn("Repeat submitting a transaction\n\tuuid:%s\n\ttxhash:%s\n\tip:%s", uuid, existingTx, req.ip)
            return;
        }
    }
    amount = lib.Unit.fromSatoshis(amount).satoshis;
    fee = lib.Unit.fromSatoshis(fee).satoshis;
    var privateKey = new lib.PrivateKey(priv);
    var address = privateKey.toAddress().toString();
    node.services.bitcoind.getAddressUnspentOutputs(address, {}, (err, utxos) => {
        if (err) {
            res.status(400).json({"error":"can not get address's utxo"});
            return;
        }
        var bitcore_trans = new lib.Transaction()
            .from(utxos)
            .to(to, amount)
            .change(address)
            .fee(fee)
            .sign(privateKey);
        var serializeError = bitcore_trans.getSerializationError();
        if (serializeError) {
            res.status(400).json({"error":"sign transaction failed"});
            logger.error("signTransaction: %s", serializeError);
            return;
        }
        var transaction_hex = bitcore_trans.serialize();
        node.services.bitcoind.sendTransaction(transaction_hex, (err, txid) => {
            if (err) {
                res.status(400).json({"error":"send transaction failed"});
                logger.error("sendTransaction: %s", err);
                return;
            }
            logger.warn("send transaction success(via %s): %s", req.ip, pretty({
                from: address,
                to: to,
                amount: amount,
                fee: fee,
                txid: txid,
                uuid: uuid
            }));
            res.json({"txid": txid});
            db.put(uuid, txid, (err) => {
                if (err) {
                    logger.error("put uuid error: %s", err);
                }
            })
        });
    });
}