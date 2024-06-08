const express = require('express');
const request = require('request');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const cron = require('node-cron');
const app = express();
const cors = require('cors');

const corsOptions = {
    origin: 'https://regal-daffodil-14c8ee.netlify.app',
    credentials: true,  
    optionsSuccessStatus: 200  
};
const db = require('./models');

app.use(cors(corsOptions));
app.use(express.json());




cron.schedule('45 7 * * *', async () => {
    console.log('Sending daily weather updates');
    subscribers= await db.Subscribers.findAll()
    console.log("subcribers ", subscribers)
    for (let subscriber of subscribers) {
        if (subscriber.confirmed) {
            // Fetch weather data
            request(`http://api.weatherapi.com/v1/forecast.json?key=8d61147511e7469ba6850823240506&q=${subscriber.location}&days=3&aqi=yes&alerts=no`,
                function (error, response, body) {
                    if (error) {
                        console.error('Error fetching weather data:', error);
                        return;
                    }

                    let data;
                    try {
                        data = JSON.parse(body);
                    } catch (parseError) {
                        console.error('Error parsing JSON:', parseError);
                        return;
                    }

                    if (!data || !data.location || !data.current || !data.forecast) {
                        console.error('Unexpected API response structure:', data);
                        return;
                    }

                    let Weather = {
                        location: data.location.name,
                        date: data.location.localtime,
                        tempature: data.current.temp_c,
                        wind_speed: data.current.wind_kph,
                        humidity: data.current.humidity,
                        weather_icons: data.current.condition.icon,
                        weather_descriptions: data.current.condition.text,
                        forecast: data.forecast.forecastday.map((day) => {
                            return {
                                date: day.date,
                                icon: day.day.condition.icon,
                                temp: day.day.avgtemp_c,
                                wind_speed: day.day.maxwind_kph,
                                humanity: day.day.avghumidity
                            };
                        })
                    };

                    // Send email
                    const transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: {
                            user: 'tranvanphuongones@gmail.com',
                            pass: 'tvce uwzi ehzh gwfm'
                        }
                    });

                    const mailOptions = {
                        from: 'tranvanphuongones@gmail.com',
                        to: subscriber.email,
                        subject: 'Daily Weather Update',
                        text: `Here is your daily weather update: ${JSON.stringify(Weather)}`
                    };

                    transporter.sendMail(mailOptions, (error, info) => {
                        if (error) {
                            console.log(error);
                        } else {
                            console.log('Daily weather update email sent');
                        }
                    });
                }
            );
        }
    }
});


app.post('/subscribe', (req, res) => {
    const email = req.body.email;
    const city = req.body.city;
    console.log("email ", email);
    console.log("city ", city);
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    if(!city){
        return res.status(400).json({ error: 'Location is required' });
    }

    try {
        request(`http://api.weatherapi.com/v1/forecast.json?key=8d61147511e7469ba6850823240506&q=${city}&days=3&aqi=yes&alerts=no`,
            function (error, response, body) {
                if (error) {
                    console.error('Error fetching weather data:', error);
                    return res.status(500).send('Internal Server Error');
                }

                let data;
                try {
                    data = JSON.parse(body);
                } catch (parseError) {
                    console.error('Error parsing JSON:', parseError);
                    return res.status(500).send('Internal Server Error');
                }

                if (!data || !data.location || !data.current || !data.forecast) {
                    console.error('Unexpected API response structure:', data);
                    return res.status(500).send('Unexpected API response structure');
                }

                console.log("data ", data);

                if (response.statusCode === 200) {
                    res.status(200)
                } else {
                    res.status(response.statusCode).send('Error: ' + response.statusText);
                }
            }
        );
    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).send('Internal Server Error');
    }

   


    const token = crypto.randomBytes(16).toString('hex'); 

    db.Subscribers.findOrCreate({
        where: { email: email },
        defaults: { token: token, location: city, confirmed: false}

    })
    .then(([subscriber, created]) => {
        if (!created) {
            subscriber.token = token;
            subscriber.location = city;
            subscriber.confirmed = false;
            subscriber.save();
        }
    })
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'tranvanphuongones@gmail.com',
            pass: 'tvce uwzi ehzh gwfm'
        }
    });

    const mailOptions = {
        from: 'tranvanphuongones@gmail.com',
        to: email,
        subject: 'Confirm your subscription',
        text: `Please confirm your subscription by clicking on the following link: https://gos-weather-server.onrender.com/confirm?token=${token}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log(error);
            res.status(500).send('Error sending confirmation email');
        } else {
            res.status(200).send('Confirmation email sent');
        }
    });
});

app.get('/confirm', async (req, res) => {
    const token = req.query.token;
    //i want to select all subscriber from database 
    console.log("token in /confirm ", token);
    subscribers= await db.Subscribers.findAll()
    console.log("subcribers day ", subscribers)
    for (let subscriber of subscribers) {
        console.log("subcriber ", subscriber);
        if (subscriber.token === token) {
            subscriber.confirmed = true;
            await subscriber.save();
            return res.status(200).send('Subscription confirmed');
        }
    }
    res.status(400).send('Invalid confirmation token');
});

app.post('/unsubscribe', async(req, res) => {
    const email = req.body.email;
    console.log("email in /unsubscribe ", email);
    subscribers= await db.Subscribers.findAll()
    for (let subscriber of subscribers) {
        console.log("subcriber ", subscriber);
        if (subscriber.email === email) {
            await subscriber.destroy();
            return res.status(200).send('Unsubscribed successfully');
        }
    }
    res.status(400).send('Email not found');
});

app.get('/', (req, res) => {
    let city = req.query.city;
    console.log("city ", city);

    if (!city) {
        return res.status(400).json({ error: 'City name is required' });
    }

    try {
        request(`http://api.weatherapi.com/v1/forecast.json?key=8d61147511e7469ba6850823240506&q=${city}&days=3&aqi=yes&alerts=no`,
            function (error, response, body) {
                if (error) {
                    console.error('Error fetching weather data:', error);
                    return res.status(500).send('Internal Server Error');
                }

                let data;
                try {
                    data = JSON.parse(body);
                } catch (parseError) {
                    console.error('Error parsing JSON:', parseError);
                    return res.status(500).send('Internal Server Error');
                }

                if (!data || !data.location || !data.current || !data.forecast) {
                    console.error('Unexpected API response structure:', data);
                    return res.status(500).send('Unexpected API response structure');
                }

                console.log("data ", data);
                let Weather = {
                    location: data.location.name,
                    date: data.location.localtime,
                    tempature: data.current.temp_c,
                    wind_speed: data.current.wind_kph,
                    humidity: data.current.humidity,
                    weather_icons: data.current.condition.icon,
                    weather_descriptions: data.current.condition.text,
                    forecast: data.forecast.forecastday.map((day) => {
                        return {
                            date: day.date,
                            icon: day.day.condition.icon,
                            temp: day.day.avgtemp_c,
                            wind_speed: day.day.maxwind_kph,
                            humanity: day.day.avghumidity
                        };
                    })
                };

                if (response.statusCode === 200) {
                    res.json(Weather);
                } else {
                    res.status(response.statusCode).send('Error: ' + response.statusText);
                }
            }
        );
    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).send('Internal Server Error');
    }
});

db.sequelize.sync().then(() => {
    app.listen(3001, () => {
        console.log('Server is running on port 3001');
    });
});

