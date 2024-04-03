//1 tab: tsc - w (tự động convert ts => js khi có thay đổi)
//1 tab: npm start
import * as express from "express";
import {Request , Response} from "express";
import * as cors from "cors";
import {createConnection,} from "typeorm"
import { Product } from "./entity/product";
import * as amqp from "amqplib/callback_api"
import { buffer } from "stream/consumers";
const bodyParser = require('body-parser');

const app = express();
// Parse URL-encoded bodies (for form data)
app.use(bodyParser.urlencoded({ extended: true }));
// Parse JSON bodies (for JSON data)
app.use(bodyParser.json());
app.use(cors({
    origin:['http://localhost:3000', 'https://localhost:8080', 'https://localhost:4200']
    // ví dụ cho phép các FE gọi đến server này
}))
app.use(express.json())

createConnection().then(db =>{
    //kết nối rabbitmq
    amqp.connect('amqps://vgqbdzaf:lA2tKR2ll9KvGKHC81QoPzKaWGAnKXlF@roedeer.rmq.cloudamqp.com/vgqbdzaf', (err, conn) =>{
        if(err) {
            throw err
        }
        conn.createChannel((error, channel)=>{
            if(error) {
                throw error
            }
            const productRepository = db.getRepository(Product)
            //get
            app.get('/api/product', async (req: Request, res: Response) =>{
                const products = await productRepository.find()
                res.json(products)
            })
             //get/id
             app.get('/api/product/:id', async (req: Request, res: Response) =>{
                const product = await productRepository.findOneBy({id : parseInt(req.params.id)})
                res.send(product)
            })
             //delete
             app.delete('/api/product/:id', async (req: Request, res: Response) =>{
                const product = await productRepository.delete({id : parseInt(req.params.id)})
                res.send(product)
            })
            //insert
            app.post('/api/product', async (req: Request, res: Response) =>{
                const product = await productRepository.create(req.body);
                const result = await productRepository.save(product)
                channel.sendToQueue('INSERT_PRODUCT', Buffer.from(JSON.stringify(result))) // tạo hàng đợi và gửi tin nhắn lên hàng đợi
                return res.send(result)
            })
            //put
            app.put('/api/product/:id', async (req: Request, res: Response) =>{
                const product = await productRepository.findOneBy({id : parseInt(req.params.id)})
                productRepository.merge(product, req.body)
                const result = await productRepository.save(product)
                res.send(result)
            })    
             //increse like 
             app.get('/api/product/:id/like', async (req: Request, res: Response) =>{
                const product = await productRepository.findOneBy({id : parseInt(req.params.id)})
                product.likes++
                const result = await productRepository.save(product)
                res.send(result)
            })   
            console.log('listening on port 8000');
            app.listen(8000)
            process.on('beforeExit', ()=>{
                console.log('closing');
                conn.close() // đóng rabbit khi máy chủ này đóng
            })
        })
    })
 
})
