import Database from '@tauri-apps/plugin-sql'
import { ref } from 'vue'

export const useDatabase = (userUid?: number) => {
  if (!userUid) {
    return {
      db: ref<Database>(),
      initDatabase: async () => {},
      closeDatabase: async () => {},
      saveMessage: async () => {},
      getMessages: async () => []
    }
  }
  const db = ref<Database>()

  /**
   * Initialize database connection
   */
  const initDatabase = async () => {
    try {
      db.value = await Database.load(`sqlite:${userUid}.db`)

      // First try to check if we need to migrate
      try {
        await db.value.select('SELECT chatId FROM message LIMIT 1')
      } catch (error) {
        // If error occurs, it means the old schema exists
        console.log('Migrating old schema to new schema...')
        await migrateDatabase()
      }

      // Create tables for this user's database
      await db.value.execute(`
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
    } catch (error) {
      console.error('Failed to initialize database:', error)
      window.$message.error('Failed to initialize database')
    }
  }

  /**
   * Migrate old database schema to new schema
   */
  const migrateDatabase = async () => {
    try {
      // Rename old table
      await db.value?.execute('ALTER TABLE message RENAME TO message_old')

      // Create new table
      await db.value?.execute(`
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
      await db.value?.execute(`
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
          from_uid as senderId,
          content as text,
          status,
          type as msgType,
          reply_msg_id as replyId
        FROM message_old
      `)

      // Drop old table
      await db.value?.execute('DROP TABLE message_old')
    } catch (error) {
      console.error('Failed to migrate database:', error)
      throw error
    }
  }

  /**
   * Close database connection
   */
  const closeDatabase = async () => {
    if (db.value) {
      try {
        await db.value.close()
      } catch (error) {
        console.error('Failed to close database:', error)
      }
    }
  }

  /**
   * Save message to database
   */
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

  /**
   * Get messages for a room
   */
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
    initDatabase,
    closeDatabase,
    saveMessage,
    getMessages
  }
}
