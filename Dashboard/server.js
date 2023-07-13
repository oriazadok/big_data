const express = require('express')
const axios = require('axios');
const cheerio = require('cheerio');
const socketIO = require('socket.io');

// redis
const Redis = require('ioredis');
const redis = new Redis();

const app = express();
app.use(express.static('public'))
app.set('view engine', 'ejs')


let jsonData = null;

async function fetchDataFromGitHub() {
  try {
    const url = 'https://raw.githubusercontent.com/aduboisforge/Bright-Star-Catalog-JSON/master/BSC.json';
    const response = await axios.get(url);
    jsonData = response.data;
    console.log('JSON file fetched from GitHub');

    redis.on('ready', async () => {
      try {
        for (const entry of jsonData) {
            await redis.hmset(`${entry['harvard_ref_#']}`, entry);
        }

        console.log('Data inserted into Redis');
      } catch (error) {
        console.error('Error inserting data into Redis:', error);
      } finally {
        redis.quit();
      }
    });
  } catch (error) {
    console.error('Error fetching JSON file from GitHub:', error);
  }
}

// Fetch the JSON file and insert data into Redis
fetchDataFromGitHub();

app.get('/', (req, res) => {
  var data = {
    cards: [
      {districtId:"haifa", title: "חיפה", value: 500, unit: "חבילות", fotterIcon: "", fotterText: "נפח ממוצע", icon: "content_copy" },
      {districtId:"dan", title: "דן", value: 1500, unit: "חבילות", fotterIcon: "", fotterText: "נפח ממוצע", icon: "store" },
      {districtId:"central", title: "מרכז", value: 3500, unit: "חבילות", fotterIcon: "", fotterText: "נפח ממוצע", icon: "info_outline" },
      {districtId:"south", title: "דרום", value: 700, unit: "חבילות", fotterIcon: "", fotterText: "נפח ממוצע", icon: "add_shopping_cart" }
    ]
  }
  res.render("pages/dashboard", data)
})

app.get('/search', (req, res) => {
  const data = [
    {
      antecedent: 'Item 1',
      consequent: 'Result 1',
      support: 80,
      confidence: 70,
    },
    {
      antecedent: 'Item 2',
      consequent: 'Result 2',
      support: 60,
      confidence: 85,
    },
    {
      antecedent: 'Item 3',
      consequent: 'Result 3',
      support: 90,
      confidence: 75,
    },
    {
      antecedent: 'Item 4',
      consequent: 'Result 4',
      support: 45,
      confidence: 60,
    },
    {
      antecedent: 'Item 5',
      consequent: 'Result 5',
      support: 70,
      confidence: 90,
    }
  ];
  res.render("pages/search", {data: data});
})

app.get('/analize', (req, res) => {
  const data = [
    {
      antecedent: 'Item 1',
      consequent: 'Result 1',
      support: 80,
      confidence: 70,
    },
    {
      antecedent: 'Item 2',
      consequent: 'Result 2',
      support: 60,
      confidence: 85,
    },
    {
      antecedent: 'Item 3',
      consequent: 'Result 3',
      support: 90,
      confidence: 75,
    },
    {
      antecedent: 'Item 4',
      consequent: 'Result 4',
      support: 45,
      confidence: 60,
    },
    {
      antecedent: 'Item 5',
      consequent: 'Result 5',
      support: 70,
      confidence: 90,
    }
  ];
  res.render("pages/analize", {data: data});
})

app.get('/red', async (req, res) => {
  try {
    const redisKeys = await redis.keys('*');
    const redisData = [];

    for (const key of redisKeys) {
      const keyType = await redis.type(key);

      if (keyType === 'hash') {
        const entry = await redis.hgetall(key);
        redisData.push(entry);
      }
    }

    res.json(redisData);
  } catch (error) {
    console.error('Error retrieving data from Redis:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/scrape', async (req, res) => {
  try {
    // Make an HTTP request to the target website
    const response = await axios.get('https://theskylive.com/sun-info');
    const html = response.data;

    // Load the HTML content using Cheerio
    const $ = cheerio.load(html);

    const riseData = $(".rise", html).text().trim().replace(/\t/g, '').split('\n');
    const transitData = $(".transit", html).text().trim().replace(/\t/g, '').split('\n');
    const setData = $(".set", html).text().trim().replace(/\t/g, '').split('\n');

    const rise = { status: riseData[1], [riseData[0].split(' ')[0]]: riseData[0].split(' ')[1], time: riseData[2] };
    const transit = { status: transitData[1], [transitData[0].split(' ')[0] + ' ' + transitData[0].split(' ')[1]]: transitData[0].split(' ')[2], time: transitData[2] };
    const set = { status: setData[1], [setData[0].split(' ')[0]]: setData[0].split(' ')[1], time: setData[2] };
    const data = { rise, transit, set };

    console.log(data);

    const tr = [];
    $('tr').each(function(index, element) {
      tr.push($(element).text());
    });

    // console.log(tr);

    // // Extracting data from the list
    // const extractedData = tr.map(item => {
    //   console.log("t: ", item);
    //   const [date, rightAscension, declination, magnitude, apparentDiameter, constellation] = item
    //     .trim()
    //     .split('\n')
    //     .map(line => line.trim());
    
    //     return {
    //         date,
    //         rightAscension,
    //         declination,
    //         magnitude,
    //         apparentDiameter,
    //         constellation,
    //     };
    // });
      
    // console.log(extractedData);
      
    // res.json({ title, paragraph });
    res.json(html);
  } catch (error) {
    // Handle any errors that occur during scraping
    res.status(500).json({ error: 'An error occurred during scraping.' });
  }
});

app.get('/setData/:districtId/:value', function (req, res) {
  io.emit('newdata',{districtId:req.params.districtId,value:req.params.value})
  res.send(req.params.value)
})

const server = express()
  .use(app)
  .listen(3000, () => console.log(`Listening Socket on http://localhost:3000`));
const io = socketIO(server);

// //------------
// // io.on('connection', (socket) => {  
// //   socket.on('newdata', (msg) => {
// //     console.log(msg);
// //     io.emit('newdata', msg);
// //   });
// // });
// //-----------
