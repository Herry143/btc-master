const supertest = require("supertest");
const should = require("should");

const app = require("../app");

const request = supertest(app);

describe("transaction.test.js", () => {
    it("POST /bitcoin/transaction", done => {
        done();
    });
    it("GET /bitcoin/transaction/sendsigned", done => {
        done();
    });
    it("GET /bitcoin/transaction/:hash/info", done => {
        request.get(`/bitcoin/transaction/e0f898eb39abdcd6849f4441a9ef43d5e2645861f049323a02069d4d908067eb/info`).end((err, res) => {
            res.body.should.have.property("from");
            res.body.should.have.property("timestamp");
            done(err);
        });
    });
    it("GET /bitcoin/transaction/:hash/confirmation", done => {
        request.get(`/bitcoin/transaction/e0f898eb39abdcd6849f4441a9ef43d5e2645861f049323a02069d4d908067eb/confirmation`).end((err, res) => {
            res.body.should.have.property("number");
            res.body.number.should.match(/^[1-9][0-9]*$/);
            done(err);
        });
    });
    it("GET /bitcoin/transaction/fee", done => {
        request.get(`/bitcoin/transaction/fee`).end((err, res) => {
            res.body.should.have.property("fee");
            res.body.fee.should.match(/^[1-9][0-9]*$/);
            done(err);
        });
    });
});