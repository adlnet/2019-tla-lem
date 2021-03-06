// Entry Point for the LRS ReRoute Service.
//
// This is a NodeJS Express application 
//
const http = require("http")
const WebSocket = require('ws');
const express = require("express");
const kafkaConsumer = require("simple-kafka-consumer");
const keycloakHelper = require("simple-keycloak-adapter");

const config = require("./config");

const APP_PORT = (process.env.APP_PORT || 3000);
const WS_PORT = (process.env.WS_PORT || 8000);
const WS_PASSWORD = (process.env.WS_PASSWORD || "some-password");

const app = express();
const server = http.createServer(app);


/**
 * The point of this page is to montior the status of our Kafka cluster.
 * 
 * To that end, our monitoring page will open a socket with this service
 * to relay messages to our page.
 */
const openSockets = []
const wss = new WebSocket.Server({
    path: config.root + "/kafka",
    server,
});

wss.on('connection', function (ws) {

    // Assign to our sockets
    openSockets.push(ws);
    ws.authenticated = false;
    ws.noMessages = true;

    ws.on("message", function (data) {
        if (ws.noMessages && data == WS_PASSWORD) {
            ws.authenticated = true;
            console.log("AUTHENTICATED SOCKET")
        } else if (data != "keep-alive") {
            ws.close();
            console.log("CLOSING: ", data)
        }
        ws.noMessages = false;
    });

    // If the socket is closed, stop sending messages to it
    ws.on("close", function close() {
        let index = openSockets.indexOf(ws);
        openSockets.splice(index, 1);
    });

    // Send an message when they connect here
    ws.send('Connected to Kafka Web Socket Monitor!');
});

setInterval(() => {
    for(let socket of openSockets) {
        if (socket.authenticated)
            socket.send("keep-alive");
    }
}, 5000)

// Broadcast a message to each open socket
//
function broadcast(message) {
    for (let k = 0; k < openSockets.length; k++) {
        if (openSockets[k].authenticated) {
            openSockets[k].send(message);
        }
    }
}

var recentCount = 0;
var throttleCount = 100;
var throttleTimerMS = 500;
var throttleWarned = false;

// Configure this with our environment and config values
kafkaConsumer.configure({
    brokers: (process.env.KAFKA_BROKER || config.kafka.brokers.join(",")),
    saslUser: (process.env.KAFKA_SASL_USER || config.kafka.sasl.username),
    saslPass: (process.env.KAFKA_SASL_PASS || config.kafka.sasl.password),
    topics: config.kafka.topics,
    consumerGroup: config.kafka.consumerGroup
})

kafkaConsumer.initConsumer((topic, offset, message) => {
    console.log(message)

    recentCount++;

    if (recentCount >= throttleCount) {
        if (throttleWarned == false) {
            broadcast(`[${message.topic}, # ${offset}, (throttled ${recentCount})]\n"High message rates will be throttled for performance with this page."`)
        }

        throttleWarned = true;
        return;
    }

    broadcast(`[${topic}, # ${offset}]\n${message}\n`)
})

// Limit how many we can receive on a duration
setInterval(function () {
    recentCount = 0;
    throttleWarned = false;
}, throttleTimerMS);

/**
 * Lastly, configure that express instance to serve this page.
 */
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.static("scripts"));
app.use(express.static("views"));
app.use(config.root, express.static("public"));
app.use(config.root, express.static("scripts"));
app.use(config.root, express.static("views"));

app.use("*", function (req, res, next) {

    if (req.baseUrl.startsWith(config.root) == false)
        res.redirect(config.root.substr(1) + req.url);
    else
        next();
});

// Setup our keycloak adapter
app.use(keycloakHelper.init(config.keycloak));

// Main page.
app.get(config.root, keycloakHelper.protect(), function (req, res, next) {
    res.render("index.ejs", {
        password: WS_PASSWORD,
        root: config.root
    });
});

// Then start the server.
server.listen(APP_PORT, function () {
    console.log("\nKafka Web Socket Example listening on port %s", APP_PORT);
});