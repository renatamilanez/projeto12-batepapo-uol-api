import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import joi from "joi";
import dayjs from 'dayjs';
import dotenv from "dotenv";
dotenv.config();

const server = express();
server.use(express.json());
server.use(cors());

let now = dayjs();

//TROCAR PARA PROCESS.ENV, NÃO ESQUECER!!!
const mongoClient = new MongoClient('mongodb://localhost:27017')

let db;
mongoClient.connect().then(() => {
    db = mongoClient.db('batePapoUol');
})

const participantSchema = joi.object({
    name: joi.string().min(3).required(),
});

const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.valid('message', 'private_message')
});

server.get('/participants', async (req, res) => {
    try {
        const participants = await db.collection('participants').find().toArray();
        res.send(participants);
    } catch (error) {
        res.sendStatus(500);
    }
});

server.post('/participants', async (req, res) => {
    const user = req.body;
    console.log(user);
    const validation = participantSchema.validate(user, {abortEarly: false});

    const name = user.name;
    const lastStatus = Date.now();
    
    if(validation.error){
        const errors = validation.error.details.map(detail => detail.message);
        return res.sendStatus(422).send(errors);
    };

    const duplicate = await db.collection('participants').findOne({name});
    if((duplicate)){
        return res.sendStatus(409);
    };

    const from = name;
    const to = 'Todos';
    const text = 'entra na sala...';
    const type = 'status';
    const time = now.format("HH:MM:SS");
    try {
        await db.collection('participants').insertOne({name, lastStatus});
        await db.collection('messages').insertOne({from, to, text, type, time});
        res.sendStatus(201);
    } catch (error) {
        res.sendStatus(500);
    }
});

server.post('/messages', async (req, res) => {
    const message = req.body;
    const {user} = req.headers;
    const from = user;
    const {to, text, type} = req.body;
    const time = now.format("HH:mm:ss");

    const validation = messageSchema.validate(message, {abortEarly: false});

    if(validation.error){
        const errors = validation.error.details.map(detail => detail.message);
        return res.sendStatus(422).send(errors);
    };

    const existUser = await db.collection('participants').findOne({name: user})
    if(!existUser){
        return res.sendStatus(422);
    };

    try {
        await db.collection('messages').insertOne({from, to, text, type, time});
        res.sendStatus(201);
    } catch (error) {
        res.sendStatus(500);
    };
});

server.get('/messages?:limit', async (req, res) => {
    const {user} = req.headers;
    let {limit} = req.query;

    try {
        const messages = await db.collection('messages').find().toArray();
        let filteredMessages = messages.filter(value => value.from === user || value.to === user || value.to === 'Todos');

        if(!limit){
            res.send(filteredMessages);
        } else {
            filteredMessages = filteredMessages.slice(-limit);
            res.send(filteredMessages);
        };
    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    }
});

server.post('status', async (req, res) => {
    const {user} = req.headers;

    const existentUser = await db.collection('participants').findOne({name: user});
    if(!existentUser){
        res.sendStatus(404);
    }

    try {
        
        res.sendStatus(200);
    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    }
})

server.listen(4000, () => {
    console.log('Listening on port 4000')
});