//1 tab: tsc - w (tự động convert ts => js khi có thay đổi)
//1 tab: npm start
import * as express from "express";
import {Request , Response} from "express";
import * as cors from "cors";
import { Product } from "./entity/product";
import {createConnection,} from "typeorm"
import * as amqp from "amqplib/callback_api"

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
    amqp.connect('amqps://vgqbdzaf:lA2tKR2ll9KvGKHC81QoPzKaWGAnKXlF@roedeer.rmq.cloudamqp.com/vgqbdzaf', (err, conn) =>{
        if(err) {
            throw err
        }
        conn.createChannel((error, channel)=>{ 
            if(error) {
                throw error
            }
             const productRepository = db.getMongoRepository(Product)
            channel.assertQueue('INSERT_PRODUCT', {durable: false})
            //kiểm tra hàng đợi tồn tại hay ko, ko thì sẽ tự tạo
            //durable = true thì mọi tin nhắn trong hàng đợi sẽ tồn tại mãi dù cho máy chủ khởi động lại
            //durable = false thì mọi tin nhắn trong hàng đợi sẽ mất hết nếu máy chủ khởi động lại'
            channel.consume("INSERT_PRODUCT", async (msg)=>{
                const eventProduct : Product = JSON.parse(msg.content.toString());
                const product = new Product()
                product.admin_id = parseInt(eventProduct.id)
                product.title = eventProduct.title
                product.image = eventProduct.image
                product.likes = eventProduct.likes
                await productRepository.save(product)
            }, {noAck : true})
            //noAck = false , gửi tin nhắn đáng tin cậy và ko sợ mất hay trùng lặp tin =>có thể tốn phí
            //noAck = true hông cần đảm bảo gửi tin nhắn nghiêm ngặt, tuy nhiên rủi ro có thể mất tin nhắn => hiệu suất tốt hơn
            console.log('listening on port 8001');
            app.listen(8001)
            process.on('beforeExit', ()=>{
                console.log('closing');
                conn.close() // đóng rabbit khi máy chủ này đóng
            })
        })
    })
    
}).catch((err) =>{
    console.log(err);
})

