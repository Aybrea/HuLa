import { create, fromBinary, toBinary } from '@bufbuild/protobuf'
import {
  ChatMsgSchema,
  ChatType,
  CSAckPushMsgSchema,
  CSAuthToken_ClientType,
  CSAuthTokenSchema,
  CSChatMsgSchema,
  CSDelChatSchema,
  CSHeartbeatSchema,
  CSPullMsgListSchema,
  CSReadMsgSchema,
  MainDataSchema,
  MessageType,
  SCAuthTokenSchema,
  SCChatMsgSchema,
  SCHeartbeatSchema,
  SCPullMsgListSchema,
  SCPushChatMsgSchema,
  SCPushLastMsgIdSchema,
  SCPushMessageInfoSchema,
  SCPushReadMsgSchema,
  SCPushDelChatSchema,
  SCInitPushDelChatsSchema,
  SCDelChatSchema,
} from './session_pb'
import { formatBigIntTimestamp } from 'src/util/date'
import { generateSnowflakeId, getCurrentTimeMsBigInt } from 'src/util/helper'

/**
 * Creates a protobuf main data message.
 * @param {MessageType} msgType - Type of the message.
 * @param {object} schema - Schema for the message.
 * @param {object} data - Payload for the message.
 * @returns {Uint8Array} Encoded main data message.
 */
export const createMainDataMessage = (msgType, schema, data) => {
  const payload = create(schema, data)
  return toBinary(
    MainDataSchema,
    create(MainDataSchema, {
      msgType,
      data: toBinary(schema, payload),
    }),
  )
}

/**
 * Encodes an authentication token message.
 * @param {string} token - Authentication token.
 * @returns {Uint8Array} Encoded authentication message.
 */
export const encodeAuthToken = (token, deviceId) =>
  createMainDataMessage(MessageType.Type_CSAuthToken, CSAuthTokenSchema, {
    token,
    clientType: CSAuthToken_ClientType.Web,
    deviceId,
  })

/**
 * Encodes a chat message.
 * @param {object} payload - Chat message details.
 * @returns {Uint8Array} Encoded chat message.
 */
export const encodeChatMsg = (payload) =>
  createMainDataMessage(MessageType.Type_CSChatMsg, CSChatMsgSchema, {
    chatId: payload.chatId,
    chatMsg: create(ChatMsgSchema, {
      content: payload.content,
      msgType: payload.msgType,
      image: payload.image,
      voice: payload.voice,
      card: payload.card,
      file: payload.file,
    }),
    clientTime: payload.clientTime,
    clientId: payload._id,
    chatType: ChatType.ChatType_Single,
  })

/**
 * Encodes an acknowledgment message.
 * @param {string} pushId - ID of the message to acknowledge.
 * @returns {Uint8Array} Encoded acknowledgment message.
 */
export const encodeAck = (pushId) =>
  createMainDataMessage(MessageType.Type_CSAckPushMsg, CSAckPushMsgSchema, {
    pushId,
  })

/**
 * Encodes a request for the last message ID.
 * @param {object} params - Request details.
 * @param {string} params.chatId - Chat ID.
 * @param {string} params.lastServerId - Last server message ID.
 * @param {string} params.lastClientId - Last client message ID.
 * @returns {Uint8Array} Encoded request message.
 */
export const encodeLastMsgId = ({ chatId, lastServerId, lastClientId }) =>
  createMainDataMessage(MessageType.Type_CSPullMsgList, CSPullMsgListSchema, {
    chatType: ChatType.ChatType_Single,
    chatId: BigInt(chatId),
    lastMsgId: BigInt(lastClientId || 0),
    pushMsgId: BigInt(lastServerId),
    count: 20,
    clientId: generateSnowflakeId(),
  })

/**
 * Creates a heartbeat message.
 * @returns {Uint8Array} Encoded heartbeat message.
 */
export const heartbeatMessage = () =>
  createMainDataMessage(MessageType.Type_CSHeartbeat, CSHeartbeatSchema, {})

/**
 * Wraps and prepares a chat message for sending.
 * @param {object} payload - Chat message details.
 * @returns {object} Wrapped message with metadata.
 */
export const wrapSendChatMessage = (payload) => {
  const clientId = generateSnowflakeId()
  const clientTime = getCurrentTimeMsBigInt()
  const { dateString, timeString } = formatBigIntTimestamp(clientTime)

  return {
    clientTime,
    content: payload.content,
    date: dateString,
    senderId: payload.senderId,
    timestamp: timeString,
    username: payload.userName,
    _id: clientId,
    clientId: clientId,
  }
}

/**
 * Encodes a read message acknowledgment.
 * @param {object} payload - Details of the read message.
 * @returns {Uint8Array} Encoded read message acknowledgment.
 */
export const encodeReadMsg = ({ chatId, chatType, msgId, clientId }) =>
  createMainDataMessage(MessageType.Type_CSReadMsg, CSReadMsgSchema, {
    readMsg: {
      chatId,
      chatType,
      msgId,
      clientId,
    },
  })

export const encodeDelChat = ({ chatId, chatType, lastId, isDelOther }) =>
  createMainDataMessage(MessageType.Type_CSDelChat, CSDelChatSchema, {
    chatInfo: {
      chatType,
      chatId,
    },
    lastId,
    isDelOther,
  })

/**
 * Decodes a received protobuf message.
 * @param {object} event - Incoming event data.
 * @returns {object|null} Decoded message or null if decoding fails.
 */
export const decodeMessage = async (event) => {
  const data = event.data
  if (typeof data === 'string') return null

  try {
    const arrayBuffer = await data.arrayBuffer()
    const message = fromBinary(MainDataSchema, new Uint8Array(arrayBuffer))
    const schema = getSchemaForMessageType(message.msgType)

    if (schema) {
      const messageContent = fromBinary(schema, message.data)
      if (
        message.msgType === MessageType.Type_SCPushChatMsg &&
        !messageContent.msgId
      ) {
        console.error("Invalid messageContent: missing 'msgId'")
      }
      return { ...messageContent, type: message.msgType }
    } else {
      console.warn('Unknown message type:', message.msgType)
      return null
    }
  } catch (error) {
    console.error('Error decoding message:', error)
    return null
  }
}

/**
 * Maps message types to their corresponding schemas.
 * @param {MessageType} msgType - Type of the message.
 * @returns {object|null} Corresponding schema or null if not found.
 */
const getSchemaForMessageType = (msgType) => {
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
    [MessageType.Type_SCInitPushDelChats]: SCInitPushDelChatsSchema,
  }
  return messageSchemaMap[msgType] || null
}
