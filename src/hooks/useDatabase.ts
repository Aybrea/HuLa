import Database from '@tauri-apps/plugin-sql'
import { ref } from 'vue'
import { RoomTypeEnum } from '../enums'

const USER_ID_KEY = 'USER_ID'

const initializedDb: { [key: number]: Database } = {}
const storedUserId = ref<number | null>(null)

interface TableExistsResult {
  name: string
}

interface ConversationTableExistsResult {
  name: string
}

let db: any = null

const saveMessage = async (message: {
  clientId: bigint
  chatId: number
  clientTime: bigint
  senderId: number
  text: string
  msgType: number
  nickname?: string
  icon?: string
  chatType?: number
  status?: number
  replyId?: number
}) => {
  if (db) {
    try {
      await db.execute(
        `INSERT INTO message (
          clientId,
          chatId,
          clientTime,
          senderId,
          nickname,
          icon,
          chatType,
          msgType,
          text,
          status,
          replyId
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          message.clientId.toString(),
          message.chatId,
          message.clientTime.toString(),
          message.senderId,
          message.nickname || '',
          message.icon || '',
          message.chatType || 0,
          message.msgType,
          message.text,
          message.status || 0,
          message.replyId || 0
        ]
      )
    } catch (error) {
      console.error('Failed to save message:', error)
      throw error
    }
  }
}

const getMessages = async (roomId: number, limit = 50, offset = 0) => {
  if (db) {
    try {
      interface MessageResult {
        clientId: number
        chatId: number
        clientTime: number
        serverTime: number
        msgId: number
        senderId: number
        nickname: string
        icon: string
        chatType: number
        msgType: number
        text: string
        status: number
        mediaWidth: number
        mediaHeight: number
        mediaUrl: string
        thumbnailUrl: string
        mediaLocalPath: string
        duration: number
        contactUserId: number
        contactNickName: string
        contactIcon: string
        fileName: string
        mediaSize: number
        md5: string
        latitude: number
        longitude: number
        place: string
        address: string
        replyId: number
      }
      const result = await db.select<MessageResult[]>(
        'SELECT * FROM message WHERE chatId = $1 ORDER BY clientTime DESC LIMIT $2 OFFSET $3',
        [roomId, limit, offset]
      )
      return result
    } catch (error) {
      console.error('Failed to get messages:', error)
      throw error
    }
  }
  return []
}

const saveConversation = async (conversation: {
  chatId: number
  type: number
  members: string
  single: { uid: number }
  unReadCount: number
}) => {
  if (conversation.type === RoomTypeEnum.SINGLE) {
    if (db) {
      try {
        await db.execute(
          `INSERT INTO conversation (chatId, type, members, userId, unReadCount) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(chatId) DO UPDATE SET type=excluded.type, members=excluded.members, userId=excluded.userId, unReadCount=excluded.unReadCount`,
          [
            conversation.chatId,
            conversation.type,
            conversation.members,
            conversation.single.uid,
            conversation.unReadCount
          ]
        )
      } catch (error) {
        console.error('Failed to save conversation:', error)
        throw error
      }
    }
  }
}

const saveUser = async (user: {
  uid: number
  nickname: string
  icon: string
  isFriend: boolean
  isBlack: boolean
  isSilent: boolean
}) => {
  if (db) {
    try {
      await db.execute(
        `INSERT INTO user (userId, nickname, icon, isFriend, isBlack, isSilent) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(userId) DO UPDATE SET nickname=excluded.nickname, icon=excluded.icon, isFriend=excluded.isFriend, isBlack=excluded.isBlack, isSilent=excluded.isSilent`,
        [user.uid, user.nickname, user.icon, user.isFriend, user.isBlack, user.isSilent]
      )
    } catch (error) {
      console.error('Failed to save user:', error)
      throw error
    }
  }
}

const getConversationDB = async () => {
  try {
    const initConversationTable = async (db: Database) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS conversation (
          "chatId" INTEGER PRIMARY KEY,
          "type" INTEGER,
          "members" TEXT,
          "userId" INTEGER,
          "unReadCount" INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_conversation_type ON conversation (type);
      `)
    }
    await initConversationTable(db)
  } catch (error) {
    console.error('Failed to initialize conversation table:', error)
    throw error
  }
}

const getUserDB = async () => {
  try {
    const initUserTable = async (db: Database) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS user (
          "userId" INTEGER PRIMARY KEY,
          "nickname" TEXT,
          "icon" TEXT,
          "isFriend" BOOLEAN,
          "isBlack" BOOLEAN,
          "isSilent" BOOLEAN
        );

        CREATE INDEX IF NOT EXISTS idx_user_isFriend ON user (isFriend);
      `)
    }
    await initUserTable(db)
  } catch (error) {
    console.error('Failed to initialize user table:', error)
    throw error
  }
}

const getGroupDB = async () => {
  try {
    const initGroupTable = async (db: Database) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS "group" (
          "chatId" INTEGER PRIMARY KEY,
          "name" TEXT,
          "icon" TEXT,
          "mute" BOOLEAN,
          "isSilent" BOOLEAN,
          "ownerId" INTEGER,
          "count" INTEGER,
          "status" INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_group_status ON "group" (status);
      `)
    }
    await initGroupTable(db)
  } catch (error) {
    console.error('Failed to initialize group table:', error)
    throw error
  }
}

const getDeletedConversationDB = async () => {
  try {
    const initDeletedConversationTable = async (db: Database) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS deletedConversation (
          "id" INTEGER PRIMARY KEY,
          "lastMsgId" INTEGER,
          "type" INTEGER,
          "delOther" BOOL
        );
      `)
    }
    await initDeletedConversationTable(db)
  } catch (error) {
    console.error('Failed to initialize deleted conversation table:', error)
    throw error
  }
}

const closeDatabase = async () => {
  // No-op for now
}

const useDatabaseInternal = async (userUid?: number) => {
  if (userUid) {
    storedUserId.value = userUid
    localStorage.setItem(USER_ID_KEY, userUid.toString())
  } else if (!storedUserId.value) {
    const storedId = localStorage.getItem(USER_ID_KEY)
    if (storedId) {
      storedUserId.value = parseInt(storedId, 10)
    }
  }

  const currentUserId = storedUserId.value

  const db = ref<Database | null>(null)
  if (currentUserId) {
    if (!initializedDb[currentUserId]) {
      initializedDb[currentUserId] = await Database.load(`sqlite:${currentUserId}.db`)
      const migrateDatabase = async (db: Database) => {
        try {
          await db.execute('BEGIN TRANSACTION') // Start transaction

          // Check if the message table exists
          const tableExists = await db.select<TableExistsResult[]>(
            'SELECT name FROM sqlite_master WHERE type="table" AND name="message"'
          )

          if (tableExists.length > 0) {
            // Rename old table if it exists
            await db.execute('ALTER TABLE message RENAME TO message_old')

            // Migrate data from old table to new table
            await db.execute(`
              INSERT INTO message (
                clientId,
                chatId,
                clientTime,
                senderId,
                text,
                status,
                msgType,
                replyId
              )
              SELECT
                id as clientId,
                room_id as chatId,
                create_time as clientTime,
                sender_id as senderId,
                content as text,
                status,
                msg_type as msgType,
                reply_id as replyId
              FROM message_old
            `)

            // Drop old table
            await db.execute('DROP TABLE message_old')
          }

          // Create new table
          await db.execute(`
            CREATE TABLE IF NOT EXISTS message (
              "clientId" INTEGER PRIMARY KEY,
              "chatId" INTEGER,
              "clientTime" INTEGER,
              "serverTime" INTEGER,
              "msgId" INTEGER,
              "senderId" INTEGER,
              "nickname" TEXT,
              "icon" TEXT,
              "chatType" INTEGER,
              "msgType" INTEGER,
              "text" TEXT,
              "status" INTEGER,
              "mediaWidth" INTEGER,
              "mediaHeight" INTEGER,
              "mediaUrl" TEXT,
              "thumbnailUrl" TEXT,
              "mediaLocalPath" TEXT,
              "duration" INTEGER,
              "contactUserId" INTEGER,
              "contactNickName" TEXT,
              "contactIcon" TEXT,
              "fileName" TEXT,
              "mediaSize" INTEGER,
              "md5" TEXT,
              "latitude" DOUBLE,
              "longitude" DOUBLE,
              "place" TEXT,
              "address" TEXT,
              "replyId" INTEGER
            )
          `)

          // Create necessary indexes
          await db.execute(`
            CREATE INDEX IF NOT EXISTS idx_chatId ON message (chatId);
            CREATE INDEX IF NOT EXISTS idx_senderId ON message (senderId);
            CREATE INDEX IF NOT EXISTS idx_clientTime ON message (clientTime);
            CREATE INDEX IF NOT EXISTS idx_serverTime ON message (serverTime);
            CREATE INDEX IF NOT EXISTS idx_msgId ON message (msgId);
          `)

          // Migrate conversation table
          const conversationTableExists = await db.select<ConversationTableExistsResult[]>(
            'SELECT name FROM sqlite_master WHERE type="table" AND name="conversation"'
          )

          if (conversationTableExists.length > 0) {
            // Rename old conversation table
            await db.execute('ALTER TABLE conversation RENAME TO conversation_old')

            // Create new conversation table with updated schema
            await db.execute(`
              CREATE TABLE conversation (
                "chatId" INTEGER PRIMARY KEY,
                "type" INTEGER,
                "members" TEXT,
                "userId" INTEGER,
                "unReadCount" INTEGER
              )
            `)

            // Migrate data from old conversation table to new table
            await db.execute(`
              INSERT INTO conversation (
                chatId,
                type,
                members,
                userId,
                unReadCount
              )
              SELECT
                chatId,
                type,
                members,
                oldUserId as userId,
                unReadCount
              FROM conversation_old
            `)

            // Drop old conversation table
            await db.execute('DROP TABLE conversation_old')

            // Create necessary indexes for conversation table
            await db.execute('CREATE INDEX IF NOT EXISTS idx_conversation_type ON conversation (type)')
          }

          await db.execute('COMMIT') // Commit the transaction
          console.log('Migration successful!')
        } catch (error) {
          console.error('Migration failed:', error)
          await db.execute('ROLLBACK') // Rollback if anything goes wrong
          throw error
        }
      }

      // First try to check if we need to migrate
      try {
        await initializedDb[currentUserId].select('SELECT chatId FROM message LIMIT 1')
      } catch (error) {
        // If error occurs, it means the old schema exists
        console.log('Migrating old schema to new schema...')
        await migrateDatabase(initializedDb[currentUserId])
      }

      // Initialize message table
      const initMessageTable = async (db: Database) => {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS message (
            "clientId" INTEGER PRIMARY KEY,
            "chatId" INTEGER,
            "clientTime" INTEGER,
            "serverTime" INTEGER,
            "msgId" INTEGER,
            "senderId" INTEGER,
            "nickname" TEXT,
            "icon" TEXT,
            "chatType" INTEGER,
            "msgType" INTEGER,
            "text" TEXT,
            "status" INTEGER,
            "mediaWidth" INTEGER,
            "mediaHeight" INTEGER,
            "mediaUrl" TEXT,
            "thumbnailUrl" TEXT,
            "mediaLocalPath" TEXT,
            "duration" INTEGER,
            "contactUserId" INTEGER,
            "contactNickName" TEXT,
            "contactIcon" TEXT,
            "fileName" TEXT,
            "mediaSize" INTEGER,
            "md5" TEXT,
            "latitude" DOUBLE,
            "longitude" DOUBLE,
            "place" TEXT,
            "address" TEXT,
            "replyId" INTEGER
          );

          CREATE INDEX IF NOT EXISTS idx_chatId ON message (chatId);
          CREATE INDEX IF NOT EXISTS idx_senderId ON message (senderId);
          CREATE INDEX IF NOT EXISTS idx_clientTime ON message (clientTime);
          CREATE INDEX IF NOT EXISTS idx_serverTime ON message (serverTime);
          CREATE INDEX IF NOT EXISTS idx_msgId ON message (msgId);
        `)
      }
      await initMessageTable(initializedDb[currentUserId])

      // Initialize conversation table
      const initConversationTable = async (db: Database) => {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS conversation (
            "chatId" INTEGER PRIMARY KEY,
            "type" INTEGER,
            "members" TEXT,
            "userId" INTEGER,
            "unReadCount" INTEGER
          );

          CREATE INDEX IF NOT EXISTS idx_conversation_type ON conversation (type);
        `)
      }
      await initConversationTable(initializedDb[currentUserId])

      // Initialize user table
      const initUserTable = async (db: Database) => {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS user (
            "userId" INTEGER PRIMARY KEY,
            "nickname" TEXT,
            "icon" TEXT,
            "isFriend" BOOLEAN,
            "isBlack" BOOLEAN,
            "isSilent" BOOLEAN
          );

          CREATE INDEX IF NOT EXISTS idx_user_isFriend ON user (isFriend);
        `)
      }
      await initUserTable(initializedDb[currentUserId])

      // Initialize group table
      const initGroupTable = async (db: Database) => {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS "group" (
            "chatId" INTEGER PRIMARY KEY,
            "name" TEXT,
            "icon" TEXT,
            "mute" BOOLEAN,
            "isSilent" BOOLEAN,
            "ownerId" INTEGER,
            "count" INTEGER,
            "status" INTEGER
          );

          CREATE INDEX IF NOT EXISTS idx_group_status ON "group" (status);
        `)
      }
      await initGroupTable(initializedDb[currentUserId])

      // Initialize deleted conversation table
      const initDeletedConversationTable = async (db: Database) => {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS deletedConversation (
            "id" INTEGER PRIMARY KEY,
            "lastMsgId" INTEGER,
            "type" INTEGER,
            "delOther" BOOL
          );
        `)
      }
      await initDeletedConversationTable(initializedDb[currentUserId])
    }

    db.value = initializedDb[currentUserId]
  }

  return {
    getDatabase: async () => db.value,
    saveMessage,
    getMessages,
    saveConversation,
    saveUser,
    getConversationDB,
    getUserDB,
    getGroupDB,
    getDeletedConversationDB,
    closeDatabase
  }
}

export const useDatabase = async (userUid?: number) => {
  if (!db) {
    const { getDatabase } = await useDatabaseInternal(userUid)
    db = await getDatabase()
  }
  return {
    database: db,
    saveMessage,
    getMessages,
    saveConversation,
    saveUser,
    getConversationDB,
    getUserDB,
    getGroupDB,
    getDeletedConversationDB,
    closeDatabase
  }
}
