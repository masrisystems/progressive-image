<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

export interface ProgressiveImageProps {
    /** Full-resolution image URL. */
    src: string;
    /** Always provide meaningful alt text; empty string marks the image decorative. */
    alt?: string;
    /** Tiny blurred placeholder shown while `src` loads. Pair with the `thumbnails` step of @masrisystems/image-pipeline. */
    thumbnailSrc?: string;
    /** Classes for the wrapper element. */
    containerClass?: string;
    /** Classes applied to both <img> layers. */
    imgClass?: string;
    /** Native lazy loading. Set false for above-the-fold images (an LCP element should load eagerly). */
    lazy?: boolean;
    /** Intrinsic dimensions. Supply both to reserve space and avoid layout shift. */
    width?: string | number;
    height?: string | number;
    /** object-fit for both layers. */
    fit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
    /** Cross-fade duration in ms. */
    duration?: number;
    /**
     * On a failed remote load, retry once with the URL's pathname.
     * Useful when a CDN is fronting assets that also exist on the origin.
     */
    localFallback?: boolean;
    /** Text shown in the error state. Defaults to `alt`, then a generic message. */
    errorText?: string;
}

const props = withDefaults(defineProps<ProgressiveImageProps>(), {
    alt: '',
    containerClass: '',
    imgClass: '',
    lazy: true,
    fit: 'cover',
    duration: 500,
    localFallback: true,
});

const emit = defineEmits<{
    (e: 'load'): void;
    (e: 'error'): void;
}>();

const isLoaded = ref(false);
const isThumbLoaded = ref(false);
const isThumbError = ref(false);
const hasError = ref(false);
const imgRef = ref<HTMLImageElement | null>(null);

const effectiveSrc = ref(props.src);
const effectiveThumbSrc = ref(props.thumbnailSrc);
const triedSrcFallback = ref(false);
const triedThumbFallback = ref(false);

const isRemote = (url?: string) => !!url && /^https?:\/\//.test(url);

/** Strip origin so a CDN URL retries against the current host. */
function toLocalPath(url?: string): string {
    if (!url) return '';
    if (isRemote(url)) {
        try {
            return new URL(url).pathname;
        } catch {
            return '';
        }
    }
    return url.startsWith('/') ? url : `/${url}`;
}

function handleLoad() {
    isLoaded.value = true;
    hasError.value = false;
    emit('load');
}

function handleError() {
    if (props.localFallback && !triedSrcFallback.value && isRemote(effectiveSrc.value)) {
        triedSrcFallback.value = true;
        const fallback = toLocalPath(effectiveSrc.value);
        if (fallback && fallback !== effectiveSrc.value) {
            effectiveSrc.value = fallback;
            return;
        }
    }
    hasError.value = true;
    isLoaded.value = true;
    emit('error');
}

function handleThumbLoad() {
    isThumbLoaded.value = true;
}

function handleThumbError() {
    if (props.localFallback && !triedThumbFallback.value && isRemote(effectiveThumbSrc.value)) {
        triedThumbFallback.value = true;
        const fallback = toLocalPath(effectiveThumbSrc.value);
        if (fallback && fallback !== effectiveThumbSrc.value) {
            effectiveThumbSrc.value = fallback;
            return;
        }
    }
    isThumbLoaded.value = false;
    isThumbError.value = true;
}

/**
 * A cached image can finish loading before Vue attaches the load handler,
 * leaving the component stuck on the placeholder. Reconcile against the
 * element's own state instead of waiting for an event that already fired.
 */
function syncWithCachedImage() {
    const el = imgRef.value;
    if (!el || !el.complete) return;
    if (el.naturalWidth > 0) {
        handleLoad();
    } else {
        handleError();
    }
}

watch(
    () => props.src,
    (next) => {
        effectiveSrc.value = next;
        triedSrcFallback.value = false;
        isLoaded.value = false;
        hasError.value = false;
        syncWithCachedImage();
    },
);

watch(
    () => props.thumbnailSrc,
    (next) => {
        effectiveThumbSrc.value = next;
        triedThumbFallback.value = false;
        isThumbLoaded.value = false;
        isThumbError.value = false;
    },
);

onMounted(syncWithCachedImage);
</script>

<template>
    <div
        class="pi-root"
        :class="containerClass"
        :style="{ '--pi-duration': `${duration}ms`, '--pi-fit': fit }"
    >
        <!-- Placeholder shimmer, hidden as soon as any layer paints -->
        <div
            v-if="!isLoaded && !hasError && !isThumbLoaded"
            class="pi-skeleton"
            aria-hidden="true"
        >
            <span class="pi-skeleton-bar" />
        </div>

        <!-- Low-res blurred layer, only when a thumbnail was supplied -->
        <img
            v-if="effectiveThumbSrc && !hasError && !isThumbError"
            :src="effectiveThumbSrc"
            alt=""
            aria-hidden="true"
            class="pi-img pi-thumb"
            :class="[imgClass, { 'pi-thumb-visible': !isLoaded && isThumbLoaded }]"
            @load="handleThumbLoad"
            @error="handleThumbError"
        />

        <!-- Full-resolution layer -->
        <img
            v-if="!hasError"
            ref="imgRef"
            :src="effectiveSrc"
            :alt="alt"
            :width="width"
            :height="height"
            :loading="lazy ? 'lazy' : 'eager'"
            :fetchpriority="lazy ? undefined : 'high'"
            decoding="async"
            class="pi-img pi-full"
            :class="[imgClass, { 'pi-full-loaded': isLoaded }]"
            @load="handleLoad"
            @error="handleError"
        />

        <!-- Error state -->
        <div v-else class="pi-error" role="img" :aria-label="errorText || alt || 'Image unavailable'">
            <svg
                class="pi-error-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
            >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="9" cy="9" r="1.5" />
                <path d="m21 15-4.35-4.35a2 2 0 0 0-2.83 0L3 21" />
            </svg>
            <span class="pi-error-text">{{ errorText || alt || 'Image unavailable' }}</span>
        </div>
    </div>
</template>

<style>
/*
 * Theming: every colour is a CSS custom property with a sane fallback, so the
 * component drops into any project. Override them anywhere in your cascade -
 * map them onto your design tokens if you have them.
 */
.pi-root {
    position: relative;
    z-index: 0;
    overflow: hidden;
    width: 100%;
    height: 100%;
    background: var(--pi-placeholder-bg, rgba(128, 128, 128, 0.12));
}

.pi-img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: var(--pi-fit, cover);
}

.pi-thumb {
    position: absolute;
    inset: 0;
    z-index: 1;
    opacity: 0;
    filter: blur(var(--pi-thumb-blur, 12px));
    transform: scale(1.04);
    transition: opacity var(--pi-duration, 500ms) ease-in-out;
}

.pi-thumb-visible {
    opacity: 1;
}

.pi-full {
    position: relative;
    z-index: 2;
    opacity: 0;
    transform: scale(1.02);
    filter: blur(8px);
    transition:
        opacity var(--pi-duration, 500ms) ease-out,
        transform var(--pi-duration, 500ms) ease-out,
        filter var(--pi-duration, 500ms) ease-out;
}

.pi-full-loaded {
    opacity: 1;
    transform: scale(1);
    filter: blur(0);
}

.pi-skeleton {
    position: absolute;
    inset: 0;
    z-index: 0;
    display: flex;
    align-items: center;
    justify-content: center;
}

.pi-skeleton-bar {
    position: relative;
    display: block;
    width: 4rem;
    height: 1px;
    overflow: hidden;
    background: var(--pi-skeleton-track, rgba(128, 128, 128, 0.3));
}

.pi-skeleton-bar::after {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--pi-skeleton-bar, currentColor);
    opacity: 0.6;
    animation: pi-pulse 1.4s ease-in-out infinite;
}

@keyframes pi-pulse {
    0%,
    100% {
        opacity: 0.2;
    }
    50% {
        opacity: 0.7;
    }
}

.pi-error {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem;
    text-align: center;
    background: var(--pi-error-bg, rgba(128, 128, 128, 0.12));
    color: var(--pi-error-fg, rgba(100, 100, 100, 0.9));
}

.pi-error-icon {
    width: 2rem;
    height: 2rem;
    opacity: 0.5;
}

.pi-error-text {
    font-size: 0.75rem;
    line-height: 1rem;
    font-weight: 500;
}

/* Respect users who ask for less motion: cut the animation, keep the fade. */
@media (prefers-reduced-motion: reduce) {
    .pi-thumb,
    .pi-full {
        transition-duration: 1ms;
        transform: none;
    }

    .pi-full {
        filter: none;
    }

    .pi-skeleton-bar::after {
        animation: none;
    }
}
</style>
