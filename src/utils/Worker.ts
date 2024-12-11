// 发消息给主进程
import { WorkerMsgEnum } from '@/enums'
import { create, fromBinary, toBinary } from '@bufbuild/protobuf'
import {
  CSHeartbeatSchema,
  MainDataSchema,
  MessageType,
  CSAuthTokenSchema,
  CSAuthToken_ClientType,
  SCPushReadMsgSchema,
  SCChatMsgSchema,
  SCHeartbeatSchema,
  SCPushChatMsgSchema,
  CSReadMsgSchema,
  SCAuthTokenSchema,
  SCPushLastMsgIdSchema,
  CSPullMsgListSchema,
  SCPullMsgListSchema,
  CSAckPushMsgSchema,
  SCPushMessageInfoSchema,
  SCDelChatSchema,
  SCPushDelChatSchema,
  SCInitPushDelChatsSchema
} from '@/buffer/session_pb'

const postMsg = ({ type, value }: { type: string; value?: object }) => {
  self.postMessage({ type, value })
}

// ws instance
let connection: WebSocket
// 心跳 timer
let heartTimer: number | null = null

// 重连次数上限
const reconnectCountMax = 5
let reconnectCount = 0
// 重连 timer
let timer: null | number = null
// 重连🔐
let lockReconnect = false
// 重连🔐
let token: null | string = null
let deviceId: null | string = null

// 往 ws 发消息
const connectionSend = (value: Uint8Array) => {
  connection?.send(value)
}

// 发送心跳 10s 内发送
const sendHeartPack = () => {
  const msg = toBinary(
    MainDataSchema,
    create(MainDataSchema, {
      msgType: MessageType.Type_CSHeartbeat,
      data: toBinary(CSHeartbeatSchema, create(CSHeartbeatSchema, {}))
    })
  )
  // 10s 检测心跳
  heartTimer = setInterval(() => {
    // 心跳消息类型 2
    connectionSend(msg)
  }, 9900) as any
}
// 清除❤️跳 timer
const clearHeartPackTimer = () => {
  if (heartTimer) {
    clearInterval(heartTimer)
    heartTimer = null
  }
}

const sendTokenPack = (token: string, deviceId: string) => {
  console.log('🚀 ~ token:', token, deviceId)
  const msg = toBinary(
    MainDataSchema,
    create(MainDataSchema, {
      msgType: MessageType.Type_CSAuthToken,
      data: toBinary(
        CSAuthTokenSchema,
        create(CSAuthTokenSchema, { token, deviceId, clientType: CSAuthToken_ClientType.Web })
      )
    })
  )
  connectionSend(msg)
}

const onCloseHandler = () => {
  clearHeartPackTimer()
  // 已经在连接中就不重连了
  if (lockReconnect) return

  // 标识重连中
  lockReconnect = true

  // 清除 timer，避免任务堆积。
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  // 达到重连次数上限
  if (reconnectCount >= reconnectCountMax) {
    reconnectCount = 0
    postMsg({ type: WorkerMsgEnum.WS_ERROR, value: { msg: '连接失败，请检查网络或联系管理员' } })
    return
  }

  // 断线重连
  timer = setTimeout(() => {
    initConnection()
    reconnectCount++
    // 标识已经开启重连任务
    lockReconnect = false
  }, 2000) as any
}

// ws 连接 error
const onConnectError = () => {
  if (connection?.readyState !== WebSocket.OPEN) {
    postMsg({ type: WorkerMsgEnum.WS_ERROR, value: { msg: '连接失败，请检查网络或联系管理员' } })
    return
  }
  onCloseHandler()
  postMsg({ type: WorkerMsgEnum.ERROR })
}
// ws 连接 close
const onConnectClose = () => {
  onCloseHandler()
  token = null
  postMsg({ type: WorkerMsgEnum.CLOSE })
}
// ws 连接成功
const onConnectOpen = () => {
  postMsg({ type: WorkerMsgEnum.OPEN })
  sendTokenPack(token as string, deviceId as string)
  // 心跳❤️检测
  sendHeartPack()
}

const getSchemaForMessageType = (msgType: any) => {
  const messageSchemaMap = {
    [MessageType.Type_SCPushReadMsg]: SCPushReadMsgSchema,
    [MessageType.Type_CSChatMsg]: SCChatMsgSchema,
    [MessageType.Type_SCHeartbeat]: SCHeartbeatSchema,
    [MessageType.Type_SCChatMsg]: SCChatMsgSchema,
    [MessageType.Type_SCPushChatMsg]: SCPushChatMsgSchema,
    [MessageType.Type_CSReadMsg]: CSReadMsgSchema,
    [MessageType.Type_CSAuthToken]: CSAuthTokenSchema,
    [MessageType.Type_SCAuthToken]: SCAuthTokenSchema,
    [MessageType.Type_SCPushLastMsgId]: SCPushLastMsgIdSchema,
    [MessageType.Type_CSPullMsgList]: CSPullMsgListSchema,
    [MessageType.Type_SCPullMsgList]: SCPullMsgListSchema,
    [MessageType.Type_CSAckPushMsg]: CSAckPushMsgSchema,
    [MessageType.Type_SCPushMessageInfo]: SCPushMessageInfoSchema,
    [MessageType.Type_SCDelChat]: SCDelChatSchema,
    [MessageType.Type_SCPushDelChat]: SCPushDelChatSchema,
    [MessageType.Type_SCInitPushDelChats]: SCInitPushDelChatsSchema
  }
  return messageSchemaMap[msgType] || null
}

// ws 连接 接收到消息
const onConnectMsg = async (e: any) => {
  const arrayBuffer = await e.data.arrayBuffer()
  const message = fromBinary(MainDataSchema, new Uint8Array(arrayBuffer))
  const schema = getSchemaForMessageType(message.msgType)
  if (schema) {
    const messageContent = fromBinary(schema, message.data)
    if (message.msgType === MessageType.Type_SCPushChatMsg && !messageContent.msgId) {
      console.error('Invalid messageContent')
    }
    const chatMsg = { ...messageContent, type: message.msgType }
    console.log('🚀 收到:', chatMsg)
    postMsg({ type: WorkerMsgEnum.MESSAGE, value: chatMsg })
  } else {
    console.warn('Unknown message type:', message.msgType)
    return null
  }
}

const initConnection = () => {
  connection?.removeEventListener('message', onConnectMsg)
  connection?.removeEventListener('open', onConnectOpen)
  connection?.removeEventListener('close', onConnectClose)
  connection?.removeEventListener('error', onConnectError)
  // 建立链接
  // 本地配置到 .env 里面修改。生产配置在 .env.production 里面
  if (!connection) {
    connection = new WebSocket(import.meta.env.VITE_WEBSOCKET_URL)
  }
  // 收到消息
  connection.addEventListener('message', onConnectMsg)
  // 建立链接
  connection.addEventListener('open', onConnectOpen)
  // 关闭连接
  connection.addEventListener('close', onConnectClose)
  // 连接错误
  connection.addEventListener('error', onConnectError)
}

self.onmessage = (e: MessageEvent<string>) => {
  const { type, value } = JSON.parse(e.data)
  switch (type) {
    case 'initWS': {
      reconnectCount = 0
      token = value.token
      deviceId = value.deviceId
      initConnection()
      break
    }
    case 'message': {
      if (connection?.readyState !== 1) return
      connectionSend(value)
      break
    }
  }
}
