const axios = require('axios');
const cheerio = require('cheerio');
const { spawn } = require('child_process');


// redis
const Redis = require('ioredis');
const redis = new Redis();


// mongo
const { MongoClient } = require('mongodb');
const moment = require('moment');
const mongoConnectionString = 'mongodb+srv://nivk99:turhvubhc@cluster0.nebl68s.mongodb.net/';



// get the data Bright Star Catalog in JSON from gitHub
async function fetchDataFromGitHubAndInsertIntoRedis() {
    try {
      const url = 'https://raw.githubusercontent.com/aduboisforge/Bright-Star-Catalog-JSON/master/BSC.json';
      const response = await axios.get(url);
      const data = response.data;
  
      await redis.flushall();
      for (const entry of data) {
        await redis.hmset(entry['harvard_ref_#'], entry);
      }
  
      console.log("Data inserted into Redis");
    } catch (error) {
      console.error("Error fetching data from GitHub or inserting data into Redis:", error);
    } finally {
      // redis.quit();
    }
}

  // get random entery from the Bright Star Catalog stored in redis
async function getRandomEntryFromRedis() {
    try {
      const redisKeys = await redis.keys('*');
  
      if (redisKeys.length === 0) {
        console.log('No entries found in Redis.');
        return null;
      }
  
      const randomKey = redisKeys[Math.floor(Math.random() * redisKeys.length)];
      const randomEntry = await redis.hgetall(randomKey);
  
      return randomEntry;
    } catch (error) {
      console.error('Error retrieving random entry from Redis:', error);
      throw error;
    }
}
  

// scrapping theskylive website
async function scrapping() {
    try {
      const response = await axios.get('https://theskylive.com/sun-info');
      const html = response.data;
  
      // Load the HTML content using Cheerio
      const $ = cheerio.load(html);
  
      ///////////////////////////////////
      // first part of the scrapping
      ///////////////////////////////////
      const riseData = $(".rise", html).text().trim().replace(/\t/g, '').split('\n');
      const transitData = $(".transit", html).text().trim().replace(/\t/g, '').split('\n');
      const setData = $(".set", html).text().trim().replace(/\t/g, '').split('\n');
  
      const rise = { status: riseData[1], [riseData[0].split(' ')[0]]: riseData[0].split(' ')[1], time: riseData[2] };
      const transit = { status: transitData[1], [transitData[0].split(' ')[0] + ' ' + transitData[0].split(' ')[1]]: transitData[0].split(' ')[2], time: transitData[2] };
      const set = { status: setData[1], [setData[0].split(' ')[0]]: setData[0].split(' ')[1], time: setData[2] };
      const data = { rise, transit, set };
  
  
      ///////////////////////////////////
      // second part of the scrapping
      ///////////////////////////////////
      const array = [];
      $('.data').each(function(index, element) {
        array.push($(element).text());
      });
  
      
      const first_table = array.slice(0, 6);
      const second_table = array.slice(6);
  
      const extractedFirstData = first_table.map(item => {
        const [PhysicalParameter, value, RelativeToEarth] = item
          .trim()
          .split('\n')
          .map(line => line.trim());
      
          return {
            PhysicalParameter,
            value,
            RelativeToEarth
          };
      });
  
      const extractedSecondData = second_table.map(item => {
        const [date, rightAscension, declination, magnitude, apparentDiameter, constellation] = item
          .trim()
          .split('\n')
          .filter(item => !/^\t+$/.test(item));
  
          return {
              date,
              rightAscension,
              declination,
              magnitude,
              apparentDiameter,
              constellation,
          };
      });
        
      ///////////////////////////////////
      // third part of the scrapping
      ///////////////////////////////////
      const srcArray = [];
      $('img').each(function(index, element) {
        srcArray.push($(element).attr('src'));
      });
  
      const baseUrl = "https://theskylive.com/";
      const sun = baseUrl + srcArray[4];
      const sky = baseUrl + srcArray[5];
      const images = { sun, sky }
      
      return { data, extractedFirstData, extractedSecondData, images };
  
    } catch (error) {
      return {}
    }
}

// get the last month neo
async function lastMonth() {
    const apiKey = "07D064f7cWtk8FCfHLBgWBZr4KS4egUbZ32wlrzt"
  
    try {
      const currentDate = new Date();
      var year = currentDate.getFullYear();
      var month = String(currentDate.getMonth() + 1).padStart(2, '0');
      var day = String(currentDate.getDate()).padStart(2, '0');
      var end_date = `${year}-${month}-${day}`;
  
      currentDate.setDate(currentDate.getDate() - 31);
      year = currentDate.getFullYear();
      month = String(currentDate.getMonth() + 1).padStart(2, '0');
      day = String(currentDate.getDate()).padStart(2, '0');
  
      start_date = `${year}-${month}-${day}`;
  
      const response = await fetch(`https://ssd-api.jpl.nasa.gov/cad.api?date-min=${start_date}&date-max=${end_date}&sort=h`);
      const data = await response.json();
      return data;
  
    } catch (error) {
      console.log('Error fetching data:', error);
      return {}
    }
}

// get the next 24 hours neo
async function next24() {
    const apiKey = "07D064f7cWtk8FCfHLBgWBZr4KS4egUbZ32wlrzt"
  
    try {
      const currentDate = new Date();
      var year = currentDate.getFullYear();
      var month = String(currentDate.getMonth() + 1).padStart(2, '0');
      var day = String(currentDate.getDate()).padStart(2, '0');
      var start_date = `${year}-${month}-${day}`;
  
      currentDate.setDate(currentDate.getDate() + 2);
      year = currentDate.getFullYear();
      month = String(currentDate.getMonth() + 1).padStart(2, '0');
      day = String(currentDate.getDate()).padStart(2, '0');
  
      end_date = `${year}-${month}-${day}`;
  
      const response = await fetch(`https://ssd-api.jpl.nasa.gov/cad.api?date-min=${start_date}&date-max=${end_date}&sort=date`);
      const data = await response.json();
      
      if (data.fields && data.data) {
        data.fields.splice(9, 1);
        data.data = data.data.map(row => row.map(value => {
          const parsedValue = parseFloat(value);
          return isNaN(parsedValue) || Number.isInteger(parsedValue) ? value : parsedValue.toFixed(1);
        }));
    
        data.data = data.data.map(row => {
          row.splice(9, 1);
          return row;
        });
    
        return data;
      }
  
    } catch (error) {
      console.log('Error fetching data:', error);
      return {}
    }
}


async function buildQuery(query) {

    var queryData = null;
    if(query) {
  
      // extract date from query
      var date = {
        "gt": query['start-date'],
        "lt": query['end-date'],
      };
      delete query['start-date'];
      delete query['end-date'];
  
      
  
      // remove the the fields that were not selected
      for (const key in query) {
        if (query[key] === 'choose') {
          delete query[key];
        }
      }
  
      // if any fields were not selected
      if( JSON.stringify(query) === '{}') {
        queryData = {
          size: 1000,
          query: {
            range: {
              date: date
            }
          }
        };
  
        return queryData;
      }
  
      // add suffix ".keybord" to the query's keys
      for (const key in query) {
        query[`${key}.keyword`] = query[key];
        delete query[key];
      }
  
      // Convert data object into an array of objects with the required format
      var must = Object.keys(query).map(key => {
        const obj = {
          term: {
            [key]: query[key]
          }
        };
        return obj;
      });
  
      must.push({
        range: {
          date
        }
      });
  
      queryData = {
        size: 1000,
        query: {
          bool: {
            must: must
          }
        }
      };
      
    } else {
      queryData = {
        size: 1000
      };
    }
  
    return queryData;
}
  
async function readElasticSearch(query) { 
const baseUrl = 'https://oriya-and-niv-2114271212.us-east-1.bonsaisearch.net:443';
const username = '5gcyxc4555';
const password = 'jn152uisr8';

// Creating a basic authentication header with the provided username and password
const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

var queryData = await buildQuery(query);

// Making a POST request to the URL with the authentication header and query data
try {
    const response = await axios.post(`${baseUrl}/sample_index/_search`, queryData,  {
    headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
    },
    });

    console.log('Query successful!');
    const data = response.data.hits.hits.map(hit => hit._source);
    return data;

} catch (error) {
    console.error('Error:', error.message);
    return [];
}
}

// function to get the most recent date and time
async function getMostRecentDateTime() {
    const baseURL = 'https://oriya-and-niv-2114271212.us-east-1.bonsaisearch.net';
    const indexName = 'sample_index';
    const username = '5gcyxc4555';
    const password = 'jn152uisr8';
  
    try {
      const response = await axios.get(`${baseURL}/${indexName}/_search`, {
        auth: {
          username,
          password
        },
        params: {
          size: 1,
        },
        data: {
          query: {
            match_all: {}
          },
          sort: [
            {
              date: {
                order: "desc"
              }
            },
            {
              "time.keyword": {
                order: "desc"
              }
            }
          ]
        }
      });
  
      // The most recent document will be available in the response.data.hits.hits array
      if (response.data.hits.hits.length > 0) {
        return response.data.hits.hits[0]._source;
      } else {
        console.log('No documents found in the index.');
      }
    } catch (error) {
      console.error('Error retrieving data from Elasticsearch:', error.message);
    }
}
  
// 
async function simbad(ra, dec) {
  return new Promise((resolve, reject) => {
    const pythonExecutable = 'python'; // Replace 'python' with the appropriate command for running Python on your system
    const scriptPath = 'C:\\Users\\oriaz\\Desktop\\big_data\\Dashboard\\simbad.py'; // Replace with the actual path to your Python script

    const pythonProcess = spawn(pythonExecutable, [scriptPath, ra, dec]);

    let output = '';
    let error = '';

    pythonProcess.stdout.on('data', (data) => {
      // console.log('Python script output:', data.toString());
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error('Python script error:', data.toString());
      error += data.toString();
    });

    pythonProcess.on('close', (code) => {
      // console.log('Python script exited with code:', code);
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(new Error(`Python script exited with code ${code}. Error: ${error.trim()}`));
      }
    });
  });
}


// this function insert data to mongo
async function insertDataToAtlas(dataToInsert) {
    try {
      // Connect to MongoDB Atlas
      const client = await MongoClient.connect(mongoConnectionString, { useNewUrlParser: true, useUnifiedTopology: true });
  
      // Get the database and collection
      const db = client.db("my_database");
      const collection = db.collection("my_collection");
  
      const result = await collection.deleteMany({});
      // console.log(`${result.deletedCount} documents deleted.`);
  
      // Loop through the dataToInsert array and insert each object into the collection
      for (const data of dataToInsert) {
        // Convert the date to ISO format using moment.js
        data.date = moment(data.date, 'YYYY MMM DD').toISOString();
  
        // Insert the data object into the collection
        await collection.insertOne(data);
        // console.log('Data inserted successfully:', data);
      }
  
      // Close the connection to the database
      client.close();
    } catch (error) {
      console.error('Error:', error);
    }
}
  
  // this function scrap data and execute insertDataToAtlas
async function mongo() {
    var dataToInsert = (await scrapping()).extractedSecondData;
  
    dataToInsert = dataToInsert.map(function removeTabs(obj) {
      for (var prop in obj) {
        if (typeof obj[prop] === 'string') {
          obj[prop] = obj[prop].replace(/\t/g, '');
        }
      }
      return obj;
    });
  
    insertDataToAtlas(dataToInsert);
};


module.exports = {
    fetchDataFromGitHubAndInsertIntoRedis,
    getRandomEntryFromRedis,
    scrapping,
    lastMonth,
    next24,
    readElasticSearch,
    getMostRecentDateTime,
    simbad,
    mongo,
};