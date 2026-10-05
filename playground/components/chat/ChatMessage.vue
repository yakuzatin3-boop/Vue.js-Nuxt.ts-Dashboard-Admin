<script setup lang="ts">
/**
 * One turn in the conversation: avatar, bubble, and the rendered reply.
 *
 * User turns are plain text. Assistant turns render `ChatReplyBlocks`, which
 * turns the structured answer into the same components the Analytics page uses.
 */
import type { ChatMessage } from '~/types/chat'
import { Bot, User } from '@lucide/vue'
import { formatDateTime } from '~/utils/format'

const props = defineProps<{
  message: ChatMessage
}>()

defineEmits<{ suggest: [question: string] }>()

const isUser = computed(() => props.message.role === 'user')

/** Epoch millis to an ISO string, which is what the `datetime` attribute needs. */
const timestamp = computed(() => new Date(props.message.at).toISOString())
</script>

<template>
  <article
    class="flex gap-3"
    :class="isUser ? 'flex-row-reverse' : ''"
  >
    <span
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
      :class="isUser ? 'bg-slate-800 text-slate-300' : 'bg-indigo-600 text-white'"
      :aria-hidden="true"
    >
      <component
        :is="isUser ? User : Bot"
        class="h-4 w-4"
      />
    </span>

    <div
      class="flex min-w-0 max-w-[min(46rem,88%)] flex-col gap-1"
      :class="isUser ? 'items-end' : 'items-start'"
    >
      <div
        class="w-full rounded-2xl px-4 py-3"
        :class="isUser
          ? 'rounded-br-md bg-indigo-600 text-white'
          : 'rounded-bl-md border border-slate-800/80 bg-slate-950/50'"
      >
        <p
          v-if="isUser"
          class="text-sm leading-6 whitespace-pre-wrap"
        >
          {{ message.text }}
        </p>

        <ChatReplyBlocks
          v-else-if="message.reply"
          :reply="message.reply"
          @suggest="$emit('suggest', $event)"
        />

        <p
          v-else
          class="text-sm leading-6 text-slate-100"
        >
          {{ message.text }}
        </p>
      </div>

      <time
        :datetime="timestamp"
        class="px-1 text-[11px] text-slate-400"
      >
        {{ isUser ? 'You' : 'Chart Bot' }} · {{ formatDateTime(timestamp) }}
      </time>
    </div>
  </article>
</template>
