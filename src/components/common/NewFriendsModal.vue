<template>
  <n-modal
    v-model:show="globalStore.newFriendModal"
    :mask-closable="false"
    class="rounded-8px"
    transform-origin="center">
    <div class="bg-[--bg-edit] w-380px h-fit box-border flex flex-col">
      <n-flex :size="6" vertical>
        <div
          v-if="type() === 'macos'"
          @click="close"
          class="mac-close size-13px shadow-inner bg-#ed6a5eff rounded-50% mt-6px select-none absolute left-6px">
          <svg class="hidden size-7px color-#000 font-bold select-none absolute top-3px left-3px">
            <use href="#close"></use>
          </svg>
        </div>

        <n-flex class="text-(14px --text-color) select-none pt-6px" justify="center">添加好友</n-flex>

        <svg
          v-if="type() === 'windows'"
          class="size-14px cursor-pointer pt-6px select-none absolute right-6px"
          @click="close">
          <use href="#close"></use>
        </svg>
        <span class="h-1px w-full bg-[--line-color]"></span>
      </n-flex>

      <n-flex vertical justify="center" :size="20" class="p-20px">
        <n-input
          v-model:value="search"
          :allow-input="(value: string) => !value.startsWith(' ') && !value.endsWith(' ')"
          :count-graphemes="countGraphemes"
          placeholder="搜索uid/phone number" />

        <n-button color="#13987f" @click="addFriend">搜索并添加</n-button>
      </n-flex>
    </div>
  </n-modal>
</template>
<script setup lang="ts">
import { useGlobalStore } from '@/stores/global.ts'
import { type } from '@tauri-apps/plugin-os'
import apis from '@/services/apis.ts'
import { useCommon } from '@/hooks/useCommon.ts'

const globalStore = useGlobalStore()
const { countGraphemes } = useCommon()
const search = ref()

const close = () => {
  globalStore.newFriendModal = false
}

const addFriend = async () => {
  await apis.searchFriend({
    search: search.value
  })
  await apis.sendAddFriendRequest({
    applyMsg: '',
    userId: requestMsg.value
  })
  window.$message.success('已添加好友')
  close()
}
</script>

<style scoped lang="scss"></style>
