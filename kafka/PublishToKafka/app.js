const express = require('express');
const app = express();
var server = require('http').createServer(app);

const port = 3000

//------------ kafka------------
const kafka = require('./publish');
//------------


app.get('/', (req, res) => res.send("<a href='/send'>Send</a> <br/><a href=''>View</a>"));
app.get('/send', (req, res) => {kafka.publish("whats up");res.send('message was sent')});


server.listen(port, () => console.log(`Ariel app listening at http://localhost:${port}`));


