import { MongoClient } from 'mongodb'

const uri = process.env.MONGO_URI
const options = {}

let client: MongoClient
let clientPromise: Promise<MongoClient>

if (!uri) {
  // MONGO_URI未設定時は未解決のPromiseを返し、未設定環境での未処理拒否(UNHANDLED REJECTION)を避ける
  // 呼び出し側は process.env.MONGO_URI の有無で実行をスキップする想定
  clientPromise = new Promise(() => {})
} else if (process.env.NODE_ENV === 'development') {
  // 開発環境では、グローバル変数を使用して接続を再利用
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>
  }

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options)
    globalWithMongo._mongoClientPromise = client.connect()
  }
  clientPromise = globalWithMongo._mongoClientPromise
} else {
  // 本番環境では、新しい接続を作成
  client = new MongoClient(uri, options)
  clientPromise = client.connect()
}

export default clientPromise

