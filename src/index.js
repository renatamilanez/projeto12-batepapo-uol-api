import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import joi from "joi";
import dayjs from 'dayjs';
import dotenv from "dotenv";
import { stripHtml } from "string-strip-html";
dotenv.config();

const server = express();
server.use(express.json());
server.use(cors());

let now = dayjs();

const mongoClient = new MongoClient('mongodb://localhost:27017');

let db;
mongoClient.connect().then(() => {
    db = mongoClient.db('batePapoUol');
});

const participantSchema = joi.object({
    name: joi.string().min(3).required()
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
        console.log(error);
        res.sendStatus(500);
    };
});

server.post('/participants', async (req, res) => {
    const user = req.body;
    const validation = participantSchema.validate(user, {abortEarly: false});

    const name = stripHtml(user.name).result.trim();
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
        console.log(error);
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
    };
});

server.post('/messages', async (req, res) => {
    const message = req.body;
    let {user} = req.headers;
    const from = user;
    let {to, text, type} = req.body;
    user = stripHtml(user).result.trim();
    to = stripHtml(to).result.trim();
    text = stripHtml(text).result.trim();

    const time = now.format("HH:mm:ss");

    const validation = messageSchema.validate(message, {abortEarly: false});

    if(validation.error){
        const errors = validation.error.details.map(detail => detail.message);
        return res.sendStatus(422).send(errors);
    };

    const existUser = await db.collection('participants').findOne({name: user});
    if(!existUser){
        return res.sendStatus(422);
    };

    try {
        await db.collection('messages').insertOne({from, to, text, type, time});
        res.sendStatus(201);
    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    };
});

server.delete('/messages/:id', async (req, res) => {
    const {user} = req.headers;
    const {id} = req.params;
    
    try {
        const existMessage = await db.collection('messages').findOne({_id: ObjectId(id)});
        if(!existMessage){
            return res.sendStatus(404);
        } if(existMessage.from !== user){
            return res.sendStatus(401);
        };
        await db.collection('messages').deleteOne({_id: ObjectId(id)});
        res.sendStatus(200);
    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    };
});

server.put('/messages/:id', async (req, res) => {
    const {to, text, type} = req.body;
    const {user} = req.headers;
    const message = req.body;
    const {id} = req.params;

    try {
        const validation = messageSchema.validate(message, {abortEarly: false});
        if(validation.error){
            const errors = validation.error.details.map(detail => detail.message);
            return res.sendStatus(422).send(errors);
        };

        const existMessage = await db.collection('messages').findOne({_id: ObjectId(id)});
        if(!existMessage){
            return res.sendStatus(404);
        } if(existMessage.from !== user){
            return res.sendStatus(401);
        };
        
        const actualization = await db.collection('messages').updateOne({_id: ObjectId(id)}, {$set: to, text, type});
        res.sendStatus(200);
    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    };
});

server.post('/status', async (req, res) => {
    const {user} = req.headers;
    const lastStatus = Date.now();

    const existentUser = await db.collection('participants').findOne({name: user});
    if(!existentUser){
        res.sendStatus(404); 
    };

    try {
        const actualization = await db.collection('participants').updateOne({name: user}, {$set: lastStatus});
        res.sendStatus(200);
    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    };
});


async function removeUser(){
    const timeNow = Date.now();
    const participants = await db.collection('participants').find().toArray();

    const to = 'Todos';
    const text = 'sai da sala...';
    const type = 'status';
    const time = now.format("HH:MM:SS");

    participants.forEach(participant => {
        if(timeNow - participant.lastStatus > 10000){
            db.collection('participants').deleteOne({name: participant.name});
            db.collection('messages').insertOne({from: participant.name, to, text, type, time});
        };
    });
};
setInterval(removeUser, 15000);

server.listen(5000, () => {
    console.log('Listening on port 5000');
});