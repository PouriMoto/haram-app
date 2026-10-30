// ==========================================
// 1. تنظیمات اولیه و متغیرهای سراسری
// ==========================================

// لینک Google Apps Script خود را اینجا قرار دهید (وقتی آماده شد)
const API_URL = ""; 

// اگر API_URL خالی باشد، برنامه در حالت تست (Mock) اجرا می‌شود
let isMock = true;

// دیتای تستی برای حالت Mock (اگر به شیت وصل نبودید)
let mockMessages = [
    { name: "زائر امام رضا (ع)", message: "سلام ای امام غریب. دلم گرفته، برام دعا کن. خیلی دوستت دارم." },
    { name: "مریم", message: "از راه دور بهت سلام می‌کنم آقا. التماس دعا دارم برای شفای مادرم." },
    { name: "علی", message: "آقا جان، این متن خیلی طولانی است تا دکمه بیشتر را تست کنیم. دلم می‌خواهم بدانم که تو هم صدای من را می‌شنوی. خیلی وقت است که درگیر مشکلات هستم و فقط به تو امید دارم. یا علی بن موسی الرضا، مدد کن." },
    { name: "سارا", message: "آقا جونم، برای گشایش کارم دعا کن. خیلی گرفتارم." },
    { name: "محمد", message: "سلام. خواستم بگم که هنوزم بهت ایمان دارم و به اینجا پناه آوردم." },
    { name: "زائر امام رضا (ع)", message: "خدایا شکرت که این امام مهربون رو داریم. آقا برامون دعا کن." },
    { name: "فاطمه", message: "برای سلامتی اقا امام زمان (عج) صلوات بفرستید." }
];

let mockStats = { totalSalavat: 1250, totalNayeb: 340 };

// متغیرهای مدیریت پیام‌ها و صفحه‌بندی
let allFetchedMessages = [];
let displayedMessagesCount = 0;
let messagesPerPage = 15;

// متغیرهای پلیر صوتی
let currentAudio = null;
let currentPlayingIndex = -1;

// ==========================================
// 2. مدیریت تب‌ها (Navigation)
// ==========================================
function switchTab(tabId, element) {
    // مخفی کردن همه تب‌ها
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    
    // نمایش تب انتخاب شده
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) targetTab.classList.add('active');
    
    // آپدیت کردن استایل نوار پایین
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    if (element) element.classList.add('active');

    // لود کردن دیتای مربوط به هر تب
    if (tabId === 'messages') {
        loadMessages();
    } else if (tabId === 'stats') {
        loadStats();
    }
    
    // اسکرول به بالا
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// 3. مدیریت Bottom Sheet (فرم ثبت درد و دل)
// ==========================================
function openBottomSheet() {
    document.getElementById('sheet-overlay').classList.add('show');
    document.getElementById('bottom-sheet').classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeBottomSheet() {
    document.getElementById('sheet-overlay').classList.remove('show');
    document.getElementById('bottom-sheet').classList.remove('show');
    document.body.style.overflow = '';
}

// افزودن متن چیپ به باکس متن
function setChip(text) {
    const textarea = document.getElementById('input-message');
    textarea.value += (textarea.value ? ' ' : '') + text + '. ';
    textarea.focus();
}

// ==========================================
// 4. ارسال پیام جدید
// ==========================================
async function submitMessage() {
    const name = document.getElementById('input-name').value.trim();
    const phone = document.getElementById('input-phone').value.trim();
    const message = document.getElementById('input-message').value.trim();
    const btn = document.getElementById('submit-btn');

    if (!message) {
        showToast('لطفاً متن درد و دل خود را بنویسید.');
        return;
    }

    btn.disabled = true;
    btn.innerText = 'در حال ارسال...';

    const payload = {
        type: 'message',
        name: name || "زائر امام رضا (ع)",
        phone: phone,
        message: message
    };

    if (isMock) {
        setTimeout(() => {
            allFetchedMessages.unshift({ name: payload.name, message: payload.message });
            finishSubmit(btn);
        }, 1000);
    } else {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            
            if (result.status === 'success') {
                finishSubmit(btn);
            } else {
                throw new Error('Server error');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('خطا در ارتباط با سرور. لطفاً دوباره تلاش کنید.');
            btn.disabled = false;
            btn.innerText = 'ارسال';
        }
    }
}

function finishSubmit(btn) {
    showToast('درد و دل شما با موفقیت ثبت شد 🌹');
    
    document.getElementById('input-message').value = '';
    document.getElementById('input-name').value = '';
    document.getElementById('input-phone').value = '';
    
    btn.disabled = false;
    btn.innerText = 'ارسال';
    
    closeBottomSheet();
    
    // هدایت مستقیم به تب درد و دل‌ها
    const msgTabNav = document.querySelectorAll('.nav-item')[1];
    switchTab('messages', msgTabNav);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// 5. دریافت و نمایش پیام‌ها (اسکرول بی‌نهایت)
// ==========================================
async function loadMessages() {
    const list = document.getElementById('chat-list');
    const loader = document.getElementById('loader');
    
    if (displayedMessagesCount > 0 && list.children.length > 0) {
        return; 
    }

    loader.classList.add('active');

    if (isMock) {
        allFetchedMessages = mockMessages;
        renderInitialMessages();
    } else {
        try {
            const res = await fetch(API_URL);
            const data = await res.json();
            allFetchedMessages = data.messages || [];
            localStorage.setItem('cachedMessages', JSON.stringify(allFetchedMessages));
            renderInitialMessages();
        } catch (e) {
            console.warn('خطا در اتصال. استفاده از کش:', e);
            const cached = localStorage.getItem('cachedMessages');
            if (cached) {
                allFetchedMessages = JSON.parse(cached);
                renderInitialMessages();
            } else {
                list.innerHTML = '<p style="text-align:center; color:#7f8c8d;">خطا در دریافت اطلاعات.</p>';
            }
        }
    }
    
    loader.classList.remove('active');
}

function renderInitialMessages() {
    const list = document.getElementById('chat-list');
    list.innerHTML = '';
    displayedMessagesCount = 0;
    
    loadMoreMessages();
    setupInfiniteScroll();
}

function loadMoreMessages() {
    const list = document.getElementById('chat-list');
    const end = displayedMessagesCount + messagesPerPage;
    const messagesToShow = allFetchedMessages.slice(displayedMessagesCount, end);
    
    messagesToShow.forEach((msg, index) => {
        const actualIndex = displayedMessagesCount + index;
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        
        const isLong = msg.message.length > 100;
        const displayText = isLong ? msg.message.substring(0, 100) + '...' : msg.message;

        bubble.innerHTML = `
            <div class="chat-name"><i class="ti ti-user-circle"></i> ${msg.name}</div>
            <div class="chat-text" id="msg-text-${actualIndex}">${displayText}</div>
            ${isLong ? `<button class="read-more-btn" id="btn-more-${actualIndex}" onclick="toggleReadMore(${actualIndex})">بیشتر</button>` : ''}
        `;
        
        list.appendChild(bubble);
        
        if (isLong) {
            setTimeout(() => {
                const btn = document.getElementById(`btn-more-${actualIndex}`);
                if (btn) btn.style.display = 'block';
            }, 50);
        }
    });
    
    displayedMessagesCount += messagesToShow.length;
}

function toggleReadMore(index) {
    const textEl = document.getElementById(`msg-text-${index}`);
    const btnEl = document.getElementById(`btn-more-${index}`);
    const fullMessage = allFetchedMessages[index].message;
    
    if (textEl.classList.contains('expanded')) {
        textEl.classList.remove('expanded');
        textEl.innerText = fullMessage.substring(0, 100) + '...';
        btnEl.innerText = 'بیشتر';
    } else {
        textEl.classList.add('expanded');
        textEl.innerText = fullMessage;
        btnEl.innerText = 'بستن';
    }
}

function setupInfiniteScroll() {
    if (window.scrollObserver) {
        window.scrollObserver.disconnect();
    }

    const sentinel = document.createElement('div');
    sentinel.id = 'scroll-sentinel';
    sentinel.style.height = '20px';
    document.getElementById('chat-list').appendChild(sentinel);

    window.scrollObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            if (displayedMessagesCount < allFetchedMessages.length) {
                loadMoreMessages();
            }
        }
    }, { rootMargin: '100px' });

    window.scrollObserver.observe(sentinel);
}

// ==========================================
// 6. آمار (صلوات و نائب‌الزیاره)
// ==========================================
async function loadStats() {
    if (isMock) {
        updateStatsUI(mockStats.totalSalavat, mockStats.totalNayeb);
        return;
    }

    try {
        const res = await fetch(API_URL);
        const data = await res.json();
        if (data.stats) {
            updateStatsUI(data.stats.totalSalavat, data.stats.totalNayeb);
        }
    } catch (e) {
        console.log('Error loading stats', e);
    }
}

function updateStatsUI(salavatCount, nayebCount) {
    document.getElementById('total-salavat-display').innerText = toPersianNum(salavatCount);
    document.getElementById('total-nayeb-display').innerText = toPersianNum(nayebCount);
}

async function sendAction(actionType) {
    if (navigator.vibrate) navigator.vibrate(50);

    const payload = { type: 'salavat', action: actionType };

    if (isMock) {
        if (actionType === 'salavat') mockStats.totalSalavat++;
        else mockStats.totalNayeb++;
        
        updateStatsUI(mockStats.totalSalavat, mockStats.totalNayeb);
        showToast(actionType === 'salavat' ? 'صلوات شما ثبت شد 🌹' : 'نائب‌الزیاره شما ثبت شد 🕊️');
    } else {
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if (data.status === 'success') {
                updateStatsUI(data.totalSalavat, data.totalNayeb);
                showToast(actionType === 'salavat' ? 'صلوات شما ثبت شد 🌹' : 'نائب‌الزیاره شما ثبت شد 🕊️');
            }
        } catch (e) {
            showToast('خطا در ارتباط با سرور');
        }
    }
}

// ==========================================
// 7. مدیریت لیست و پخش آهنگ‌ها (Music Player)
// ==========================================
async function loadMusicPlaylist() {
    const musicContainer = document.getElementById('music-list');
    
    try {
        const response = await fetch('assets/music/playlist.json');
        if (!response.ok) throw new Error('File not found');
        
        const songs = await response.json();
        musicContainer.innerHTML = '';
        
        if (songs.length === 0) {
            musicContainer.innerHTML = '<p style="text-align:center; color:#7f8c8d;">آهنگی موجود نیست.</p>';
            return;
        }

        songs.forEach((song, index) => {
            const card = document.createElement('div');
            card.className = 'media-card';
            card.id = `music-card-${index}`;
            card.style.cursor = 'pointer';
            
            const coverHtml = song.cover 
                ? `<img src="${song.cover}" class="music-cover" alt="${song.title}" onerror="this.outerHTML='<div class=\\'media-icon\\' style=\\'background:#e8f5e9; color:#43a047;\\'><i class=\\'ti ti-music\\'></i></div>'">`
                : `<div class="media-icon" style="background:#e8f5e9; color:#43a047;"><i class="ti ti-music"></i></div>`;

            card.innerHTML = `
                ${coverHtml}
                <div class="media-info">
                    <h3>${song.title}</h3>
                    <p>${song.artist}</p>
                </div>
                <div class="music-play-icon">
                    <i class="ti ti-player-play" id="music-icon-${index}"></i>
                </div>
            `;
            
            card.onclick = () => playMusic(song, index);
            musicContainer.appendChild(card);
        });

    } catch (error) {
        console.error('Error loading music playlist:', error);
        musicContainer.innerHTML = `
            <p style="text-align:center; color:#d32f2f; padding: 10px;">
                خطا در بارگذاری آهنگ‌ها. فایل playlist.json را بررسی کنید.
            </p>
        `;
    }
}

function playMusic(song, index) {
    const icon = document.getElementById(`music-icon-${index}`);
    const miniPlayer = document.getElementById('mini-player');
    const miniTitle = document.getElementById('mini-player-title');
    const miniIcon = document.getElementById('mini-player-icon');
    
    // اگر همین آهنگ در حال پخش بود، Pause/Play کن
    if (currentPlayingIndex === index && currentAudio) {
        if (currentAudio.paused) {
            currentAudio.play();
            icon.className = 'ti ti-player-pause';
            miniIcon.className = 'ti ti-player-pause';
        } else {
            currentAudio.pause();
            icon.className = 'ti ti-player-play';
            miniIcon.className = 'ti ti-player-play';
        }
        return;
    }

    // اگر آهنگ دیگری در حال پخش بود، متوقفش کن
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
        if (currentPlayingIndex !== -1) {
            const prevIcon = document.getElementById(`music-icon-${currentPlayingIndex}`);
            if (prevIcon) prevIcon.className = 'ti ti-player-play';
        }
    }

    // شروع پخش آهنگ جدید
    currentAudio = new Audio(song.src);
    currentAudio.play();
    currentPlayingIndex = index;
    icon.className = 'ti ti-player-pause';

    // فعال کردن Mini Player
    miniPlayer.classList.add('active');
    miniTitle.innerText = song.title + ' - ' + song.artist;
    miniIcon.className = 'ti ti-player-pause';

    // وقتی آهنگ تمام شد
    currentAudio.onended = () => {
        icon.className = 'ti ti-player-play';
        currentPlayingIndex = -1;
        currentAudio = null;
        miniPlayer.classList.remove('active');
    };

    showToast(`در حال پخش: ${song.title}`);
}

// تابع برای Play/Pause از داخل Mini Player
function toggleMiniPlayer() {
    const miniIcon = document.getElementById('mini-player-icon');
    if (currentAudio) {
        if (currentAudio.paused) {
            currentAudio.play();
            miniIcon.className = 'ti ti-player-pause';
            if (currentPlayingIndex !== -1) {
                const cardIcon = document.getElementById(`music-icon-${currentPlayingIndex}`);
                if (cardIcon) cardIcon.className = 'ti ti-player-pause';
            }
        } else {
            currentAudio.pause();
            miniIcon.className = 'ti ti-player-play';
            if (currentPlayingIndex !== -1) {
                const cardIcon = document.getElementById(`music-icon-${currentPlayingIndex}`);
                if (cardIcon) cardIcon.className = 'ti ti-player-play';
            }
        }
    }
}

// تابع برای بستن کامل نوار پلیر (حذف آهنگ)
function closeMiniPlayer() {
    const miniPlayer = document.getElementById('mini-player');
    
    // متوقف کردن آهنگ
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    
    // برگرداندن آیکون کارت اصلی به حالت اول
    if (currentPlayingIndex !== -1) {
        const cardIcon = document.getElementById(`music-icon-${currentPlayingIndex}`);
        if (cardIcon) cardIcon.className = 'ti ti-player-play';
    }
    
    // مخفی کردن نوار پلیر
    miniPlayer.classList.remove('active');
    currentPlayingIndex = -1;
}

// ==========================================
// 8. توابع کمکی (Toast و تبدیل اعداد)
// ==========================================
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function toPersianNum(num) {
    return num.toString().replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
}

// ==========================================
// 9. اجرای اولیه هنگام لود شدن صفحه
// ==========================================
window.onload = () => {
    if (!API_URL) {
        isMock = true;
        console.log("حالت تست (Mock) فعال است.");
    } else {
        isMock = false;
        console.log("اتصال به Google Sheets فعال است.");
    }

    // لود کردن آمار اولیه
    loadStats();
    
    // لود کردن لیست آهنگ‌ها
    loadMusicPlaylist();
};