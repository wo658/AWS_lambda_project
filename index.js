const mongoose = require('mongoose');
const MONGODB_URI = process.env.MONGODB_URI;

/* 날씨 오브젝트 정의 */
const weatherSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true
  },
  region: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  weatherCondition: {
    type: String,
    required: true
  },
  temperature: {
    type: Number,
    min: -100,
    max: 100,
    required: true
  }
});

const Weather = mongoose.model('weather', weatherSchema);

let connection = null;
const connect = () => {
  if (connection && mongoose.connection.readyState === 1) {
    return Promise.resolve(connection);
  } else {
    return mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
      .then(conn => {
        connection = conn;
        return connection;
      })
      .catch(err => {
        console.error('Connection error:', err);
        throw err;
      });
  }
};

exports.handler = async (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  let operation = event.httpMethod;

  switch (operation) {
    case 'POST':
      /* 경로 /weather   
         파라미터 region, weatherCondition, temperature, date 
      */
      try {
        await connect();
        const lastWeather = await Weather.findOne({}).sort({ id: -1 }).exec();
        const lastID = lastWeather ? lastWeather.id : 0;
        const { region, weatherCondition, temperature, date } = JSON.parse(event.body);

        const newWeather = new Weather({
          id: lastID + 1,
          region,
          weatherCondition,
          temperature,
          date
        });

        await newWeather.save();
        callback(null, {
          statusCode: 200,
          body: JSON.stringify({ id: lastID + 1 })
        });
      } catch (err) {
        console.error('Error handling POST request:', err);
        callback(null, {
          statusCode: 500,
          body: JSON.stringify(err)
        });
      }
      break;

    case 'GET':
      /* /weather  전체 날씨 정보 불러오기 */
      try {
        await connect();
        let query = {};
        if (event.queryStringParameters) {
          if (event.queryStringParameters.region) {
            query.region = {
              $regex: event.queryStringParameters.region,
              $options: 'i'
            };
          }
          if (event.queryStringParameters.weatherCondition) {
            query.weatherCondition = {
              $regex: event.queryStringParameters.weatherCondition,
              $options: 'i'
            };
          }
        }
        const weatherData = await Weather.find(query).sort({ id: -1 }).exec();
        callback(null, {
          statusCode: 200,
          body: JSON.stringify(weatherData)
        });
      } catch (err) {
        console.error('Error handling GET request:', err);
        callback(null, {
          statusCode: 500,
          body: JSON.stringify(err)
        });
      }
      break;
    case 'DELETE':
      /* /weather/{id} 특정 ID의 날씨 정보 삭제하기 */
      try {
        await connect();
        const id = event.pathParameters.proxy;
        await Weather.deleteOne({ id: id }).exec();
        callback(null, {
          statusCode: 200,
          body: JSON.stringify({ message: `Weather entry with id ${id} deleted successfully.` })
        });
      } catch (err) {
        console.error('Error handling DELETE request:', err);
        callback(null, {
          statusCode: 500,
          body: JSON.stringify(err)
        });
      }
      break;
    
    case 'PUT':
      /* /weather/{id} 특정 ID의 날씨 정보 전체 수정 */
      try {
        await connect();
        const id = event.pathParameters.proxy;
        const { region, weatherCondition, temperature, date } = JSON.parse(event.body);

        const updatedWeather = await Weather.findOneAndUpdate(
          { id: id },
          { region:region , weatherCondition:weatherCondition, temperature:temperature, date:date },
          { new: true }
        );

        if (!updatedWeather) {
          callback(null, {
            statusCode: 404,
            body: JSON.stringify({ message: `Weather entry with id ${id} not found.` })
          });
        } else {
          callback(null, {
            statusCode: 200,
            body: JSON.stringify(updatedWeather)
          });
        }
      } catch (err) {
        console.error('Error handling PUT request:', err);
        callback(null, {
          statusCode: 500,
          body: JSON.stringify(err)
        });
      }
      break;

    case 'PATCH':
      /* /weather/{id} 특정 ID의 날씨 정보 부분 수정 */
      try {
        await connect();
        const id = event.pathParameters.proxy;
        const updateFields = JSON.parse(event.body);

        const updatedWeather = await Weather.findOneAndUpdate(
          { id: id },
          { $set: updateFields },
          { new: true }
        );

        if (!updatedWeather) {
          callback(null, {
            statusCode: 404,
            body: JSON.stringify({ message: `Weather entry with id ${id} not found.` })
          });
        } else {
          callback(null, {
            statusCode: 200,
            body: JSON.stringify(updatedWeather)
          });
        }
      } catch (err) {
        console.error('Error handling PATCH request:', err);
        callback(null, {
          statusCode: 500,
          body: JSON.stringify(err)
        });
      }
      break;
      
    default:
      callback(new Error(`Operation Error: "${operation}"`));
  }
};