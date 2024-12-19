import Database from '@tauri-apps/plugin-sql'
import { ref } from 'vue'

const initializedDb: { [key: number]: Database } = {}

export const useDatabase = async (userUid?: number) => {
  if (!userUid) {
    return {
      db: ref<Database>(),
      getDatabase: async () => {},
      closeDatabase: async () => {},
      saveMessage: async () => {},
      getMessages: async () => []
    }
  }

  if (!initializedDb[userUid]) {
    initializedDb[userUid] = await Database.load(`sqlite:${userUid}.db`)

    const migrateDatabase = async (db: Database) => {
      try {
        // Rename old table
        await db.execute('ALTER TABLE message RENAME TO message_old')

        // Create new table
        await db.execute(`
          CREATE TABLE message (
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

        // Create necessary indexes
        await db.execute(`
          CREATE INDEX IF NOT EXISTS idx_chatId ON message (chatId);
          CREATE INDEX IF NOT EXISTS idx_senderId ON message (senderId);
          CREATE INDEX IF NOT EXISTS idx_clientTime ON message (clientTime);
          CREATE INDEX IF NOT EXISTS idx_serverTime ON message (serverTime);
          CREATE INDEX IF NOT EXISTS idx_msgId ON message (msgId);
        `)
      } catch (error) {
        console.error('Migration failed:', error)
        throw error
      }
    }

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

    // First try to check if we need to migrate
    try {
      await initializedDb[userUid].select('SELECT chatId FROM message LIMIT 1')
    } catch (error) {
      // If error occurs, it means the old schema exists
      console.log('Migrating old schema to new schema...')
      await migrateDatabase(initializedDb[userUid])
    }

    // Initialize message table
    await initMessageTable(initializedDb[userUid])

    // Initialize conversation table
    const initConversationTable = async (db: Database) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS conversation (
          "chatId" INTEGER PRIMARY KEY,
          "type" INTEGER,
          "members" TEXT,
          "uid" INTEGER,
          "unReadCount" INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_conversation_type ON conversation (type);
      `)
    }
    await initConversationTable(initializedDb[userUid])

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
    await initUserTable(initializedDb[userUid])

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
    await initGroupTable(initializedDb[userUid])

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
    await initDeletedConversationTable(initializedDb[userUid])
  }

  const db = ref<Database>(initializedDb[userUid])

  const getConversationDB = async () => {
    try {
      const initConversationTable = async (db: Database) => {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS conversation (
            "chatId" INTEGER PRIMARY KEY,
            "type" INTEGER,
            "members" TEXT,
            "uid" INTEGER,
            "unReadCount" INTEGER
          );

          CREATE INDEX IF NOT EXISTS idx_conversation_type ON conversation (type);
        `)
      }
      await initConversationTable(db.value!)
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
      await initUserTable(db.value!)
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
      await initGroupTable(db.value!)
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
      await initDeletedConversationTable(db.value!)
    } catch (error) {
      console.error('Failed to initialize deleted conversation table:', error)
      throw error
    }
  }

  const closeDatabase = async () => {
    delete initializedDb[userUid]
  }

  const saveMessage = async (message: {
    chatId: number
    senderId: number
    text: string
    msgType: number
    nickname?: string
    icon?: string
    chatType?: number
    status?: number
    replyId?: number
  }) => {
    try {
      const currentTime = new Date().getTime()
      await db.value?.execute(
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
          currentTime, // Use timestamp as clientId
          message.chatId,
          currentTime,
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

  const getMessages = async (roomId: number, limit = 50, offset = 0) => {
    try {
      const result = await db.value?.select(
        'SELECT * FROM message WHERE chatId = $1 ORDER BY clientTime DESC LIMIT $2 OFFSET $3',
        [roomId, limit, offset]
      )
      return result
    } catch (error) {
      console.error('Failed to get messages:', error)
      throw error
    }
  }

  return {
    db,
    getDatabase: async () => db.value,
    getConversationDB,
    getUserDB,
    getGroupDB,
    getDeletedConversationDB,
    closeDatabase,
    saveMessage,
    getMessages
  }
}
