'use strict';

const level = require("level");
const db = level("/root/sendTxDB");

module.exports = db;