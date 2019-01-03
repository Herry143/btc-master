const lib = require('bitcore-lib');
const node = require("../lib/bitcore-node");
const cw = require("../lib/cw");

exports.send = async function(req, res) {
    if (req.protocol !== "https") {
        return res.status(403).json({error: "must use https"});
    }
    var amount = req.body.amount;
    var to = req.body.to;
    var fee = req.body.fee;
    let uuid = req.body.uuid;
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
    //如果uuid存在，则返回已经存在的transactionHash，并且立即返回，不执行交易
    let existingTx = await db.get(uuid).catch(err => {
        if (err.notFound) {
            return undefined;
        } else {
            return {srvErr: err};
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
        var usdt = "6f6d6e69000000000000001f"
        var pad = "0000000000000000";
        var amountstr = amount.toString(16);
        var opreturnstr = usdt + pad.substring(0, 16 - amountstr.length) + amountstr;
        var opreturn = Buffer.from(opreturnstr, 'hex');
        var bitcore_trans = new lib.Transaction()
            .from(utxos)
            .to(to, 546)
            .change(address)
            .fee(fee)
            .addData(opreturn)
            .sign(priv);
        var serializeError = bitcore_trans.getSerializationError();
        if (serializeError) {
            res.status(400).json({"error":"sign transaction failed"});
            return;
        }
        var transaction_hex = bitcore_trans.serialize();
        node.services.bitcoind.sendTransaction(transaction_hex, (err, txid) => {
            if (err) {
                res.status(400).json({"error":"send transaction failed"});
                return;
            }
            res.json({"txid":txid});
            logger.warn("send USDT transaction success(via %s): %s", req.ip, pretty({
                from: address,
                to: to,
                amount: amount,
                fee: fee,
                txid: txid,
                uuid: uuid
            }));
            //执行交易成功，将uuid放入db
            db.put(uuid, txid, (err) => {
                if (err) {
                    logger.error("put uuid error: %s", err);
                }
            })
        });
    })
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
        })

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
    let uuid = req.body.uuid;
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
    //如果uuid存在，则返回已经存在的transactionHash，并且立即返回，不执行交易
    let existingTx = await db.get(uuid).catch(err => {
        if (err.notFound) {
            return undefined;
        } else {
            return {srvErr: err};
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
        var usdt = "6f6d6e69000000000000001f"
        var pad = "0000000000000000";
        var amountstr = amount.toString(16);
        var opreturnstr = usdt + pad.substring(0, 16 - amountstr.length) + amountstr;
        var opreturn = Buffer.from(opreturnstr, 'hex');
        var bitcore_trans = new lib.Transaction()
            .from(utxos)
            .to(to, 546)
            .change(address)
            .fee(fee)
            .addData(opreturn)
            .sign(priv);
        var serializeError = bitcore_trans.getSerializationError();
        if (serializeError) {
            res.status(400).json({"error":"sign transaction failed"});
            return;
        }
        var transaction_hex = bitcore_trans.serialize();
        var txid = lib.crypto.Hash.sha256(Buffer.from(transaction_hex, 'hex')).toString('hex')
        res.json({ "txid": txid });
        logger.warn("send USDT transaction success(via %s): %s", req.ip, pretty({
            from: address,
            to: to,
            amount: amount,
            fee: fee,
            txid: txid,
            uuid: uuid
        }));
        //执行交易成功，将uuid放入db
        db.put(uuid, txid, (err) => {
            if (err) {
                logger.error("put uuid error: %s", err);
            }
        })
    })
}

exports.sendAdmin = async function(req, res) {
    if (req.protocol !== "https") {
        return res.status(403).json({error: "must use https"});
    }
    var amount = req.body.amount;
    var to = req.body.to;
    var fee = req.body.fee;
    let uuid = req.body.uuid;
    let priv = req.body.privateKey;
    if (!lib.PrivateKey.isValid(priv)) {
        return res.status(400).json({error: "privateKey invalid"});
    }
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
    //如果uuid存在，则返回已经存在的transactionHash，并且立即返回，不执行交易
    let existingTx = await db.get(uuid).catch(err => {
        if (err.notFound) {
            return undefined;
        } else {
            return {srvErr: err};
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
        var usdt = "6f6d6e69000000000000001f"
        var pad = "0000000000000000";
        var amountstr = amount.toString(16);
        var opreturnstr = usdt + pad.substring(0, 16 - amountstr.length) + amountstr;
        var opreturn = Buffer.from(opreturnstr, 'hex');
        var bitcore_trans = new lib.Transaction()
            .from(utxos)
            .to(to, 546)
            .change(address)
            .fee(fee)
            .addData(opreturn)
            .sign(priv);
        var serializeError = bitcore_trans.getSerializationError();
        if (serializeError) {
            res.status(400).json({"error":"sign transaction failed"});
            return;
        }
        var transaction_hex = bitcore_trans.serialize();
        node.services.bitcoind.sendTransaction(transaction_hex, (err, txid) => {
            if (err) {
                res.status(400).json({"error":"send transaction failed"});
                return;
            }
            res.json({"txid":txid});
            logger.warn("send USDT transaction success(via %s): %s", req.ip, pretty({
                from: address,
                to: to,
                amount: amount,
                fee: fee,
                txid: txid,
                uuid: uuid
            }));
            //执行交易成功，将uuid放入db
            db.put(uuid, txid, (err) => {
                if (err) {
                    logger.error("put uuid error: %s", err);
                }
            })
        });
    })
}