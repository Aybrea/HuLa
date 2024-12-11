// 工具函数，用于获取当前时间的 BigInt 表示
export const getCurrentTimeMsBigInt = () => BigInt(Date.now())

// 配置雪花算法的参数
const MACHINE_ID_BITS = 10n // 机器 ID 占用的位数
const SEQUENCE_BITS = 12n // 序列号占用的位数
const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n // 序列号的最大值

// 动态生成 EPOCH（以首次生成 ID 的时间为基准）
const EPOCH = 1731492000000n // 确保 EPOCH 是 BigInt 类型

// 随机生成 MACHINE_ID，并确保它是 BigInt 类型
const MACHINE_ID = BigInt(Math.floor(Math.random() * Number(1n << MACHINE_ID_BITS)))

// 序列号及上次时间戳
let sequence = 0n
let lastTimestamp = -1n

// 生成雪花算法的 ID
export function generateSnowflakeId() {
  let timestamp = getCurrentTimeMsBigInt()

  // 如果当前时间等于上次时间戳，则增加序列号
  if (timestamp === lastTimestamp) {
    sequence = (sequence + 1n) & MAX_SEQUENCE
    if (sequence === 0n) {
      // 如果序列号已达最大值，则等待下一毫秒
      while (timestamp <= lastTimestamp) {
        timestamp = getCurrentTimeMsBigInt()
      }
    }
  } else {
    // 如果是新的时间戳，则重置序列号
    sequence = 0n
  }

  lastTimestamp = timestamp

  // 生成雪花 ID
  const id =
    ((timestamp - EPOCH) << (MACHINE_ID_BITS + SEQUENCE_BITS)) | // 时间戳偏移
    (MACHINE_ID << SEQUENCE_BITS) | // 机器 ID 偏移
    sequence // 序列号

  return id.toString() // 返回字符串形式的 ID
}
