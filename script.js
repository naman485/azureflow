// CloudVault - Enterprise File Upload Handler
// Supports files larger than 100GB with chunked upload simulation

// DOM Elements
const dropZone = document.getElementById('dropZone');
const uploadModal = document.getElementById('uploadModal');
const modalDropZone = document.getElementById('modalDropZone');
const fileInput = document.getElementById('fileInput');
const uploadQueue = document.getElementById('uploadQueue');
const totalSizeEl = document.getElementById('totalSize');
const startUploadBtn = document.getElementById('startUploadBtn');
const uploadsSection = document.getElementById('uploadsSection');
const uploadsList = document.getElementById('uploadsList');

// Configuration
const MAX_FILE_SIZE = 500 * 1024 * 1024 * 1024; // 500GB
const CHUNK_SIZE = 100 * 1024 * 1024; // 100MB chunks

// State
let selectedFiles = [];
let uploadProgress = {};
let activeUploads = new Map();

// Utility Functions
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTimeRemaining(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
}

function getFileIcon(filename, type) {
  const ext = filename.split('.').pop().toLowerCase();
  
  const iconConfigs = {
    video: { bg: 'from-blue-50 to-indigo-50', color: 'text-blue-500', path: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
    archive: { bg: 'from-purple-50 to-violet-50', color: 'text-purple-500', path: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' },
    image: { bg: 'from-emerald-50 to-teal-50', color: 'text-emerald-500', path: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
    audio: { bg: 'from-rose-50 to-pink-50', color: 'text-rose-500', path: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3' },
    document: { bg: 'from-amber-50 to-orange-50', color: 'text-amber-500', path: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    code: { bg: 'from-cyan-50 to-sky-50', color: 'text-cyan-500', path: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    default: { bg: 'from-slate-50 to-gray-50', color: 'text-slate-500', path: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z' }
  };

  // Determine type by extension
  const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv'];
  const archiveExts = ['zip', 'rar', 'tar', '7z', 'gz', 'bz2', 'iso'];
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'raw', 'cr2', 'nef'];
  const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'];
  const documentExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'sql', 'csv'];
  const codeExts = ['js', 'ts', 'py', 'java', 'cpp', 'c', 'h', 'html', 'css', 'json', 'xml'];

  let iconType = 'default';
  if (videoExts.includes(ext) || type?.startsWith('video/')) iconType = 'video';
  else if (archiveExts.includes(ext)) iconType = 'archive';
  else if (imageExts.includes(ext) || type?.startsWith('image/')) iconType = 'image';
  else if (audioExts.includes(ext) || type?.startsWith('audio/')) iconType = 'audio';
  else if (documentExts.includes(ext)) iconType = 'document';
  else if (codeExts.includes(ext)) iconType = 'code';

  return iconConfigs[iconType];
}

// Modal Functions
function openUploadModal() {
  uploadModal.classList.remove('hidden');
  uploadModal.classList.add('flex');
  document.body.style.overflow = 'hidden';
}

function closeUploadModal() {
  uploadModal.classList.add('hidden');
  uploadModal.classList.remove('flex');
  document.body.style.overflow = '';
  selectedFiles = [];
  uploadProgress = {};
  renderUploadQueue();
}

// File Handling
function handleFiles(files) {
  const fileArray = Array.from(files);
  
  fileArray.forEach(file => {
    if (file.size > MAX_FILE_SIZE) {
      alert(`File "${file.name}" exceeds the maximum size of 500GB`);
      return;
    }
    
    // Avoid duplicates
    if (!selectedFiles.find(f => f.name === file.name && f.size === file.size)) {
      selectedFiles.push(file);
    }
  });
  
  renderUploadQueue();
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  renderUploadQueue();
}

function renderUploadQueue() {
  if (selectedFiles.length === 0) {
    uploadQueue.innerHTML = '';
    totalSizeEl.textContent = '0 files selected';
    startUploadBtn.disabled = true;
    return;
  }

  const total = selectedFiles.reduce((acc, file) => acc + file.size, 0);
  totalSizeEl.textContent = `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} (${formatFileSize(total)})`;
  startUploadBtn.disabled = false;

  uploadQueue.innerHTML = selectedFiles.map((file, index) => {
    const icon = getFileIcon(file.name, file.type);
    const progress = uploadProgress[file.name] || 0;
    const isLarge = file.size > 1024 * 1024 * 1024;
    
    return `
      <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl group hover:bg-slate-100 transition-colors">
        <div class="w-10 h-10 rounded-lg bg-gradient-to-br ${icon.bg} flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 ${icon.color}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${icon.path}"/>
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between mb-1">
            <h5 class="text-sm font-medium text-slate-800 truncate pr-2">${file.name}</h5>
            <div class="flex items-center gap-2 flex-shrink-0">
              ${isLarge ? '<span class="text-xs text-primary-600 font-medium">Large file</span>' : ''}
              <span class="text-xs text-slate-500">${formatFileSize(file.size)}</span>
            </div>
          </div>
          ${progress > 0 ? `
            <div class="h-1 bg-slate-200 rounded-full overflow-hidden">
              <div class="h-full progress-gradient rounded-full transition-all duration-300" style="width: ${progress}%"></div>
            </div>
          ` : ''}
        </div>
        <button onclick="removeFile(${index})" class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    `;
  }).join('');
}

// Upload Functions
function startUpload() {
  if (selectedFiles.length === 0) return;
  
  // Close modal and show uploads section
  closeUploadModal();
  uploadsSection.classList.remove('hidden');
  
  // Add files to upload list
  selectedFiles.forEach((file, index) => {
    const id = Date.now() + '-' + index;
    uploadsList.insertAdjacentHTML('beforeend', createUploadItem(file, id));
    
    setTimeout(() => simulateUpload(file, id), 100 * index);
  });
  
  selectedFiles = [];
}

function createUploadItem(file, id) {
  const icon = getFileIcon(file.name, file.type);
  const isLargeFile = file.size > 1024 * 1024 * 1024;
  
  return `
    <div id="upload-${id}" class="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br ${icon.bg} flex items-center justify-center flex-shrink-0">
          <svg class="w-6 h-6 ${icon.color}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${icon.path}"/>
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between mb-2">
            <div>
              <h4 class="font-medium text-slate-800 truncate">${file.name}</h4>
              <p class="text-sm text-slate-500">${formatFileSize(file.size)}${isLargeFile ? ' • Chunked Transfer' : ''}</p>
            </div>
            <button onclick="cancelUpload('${id}')" class="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="relative h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
            <div id="progress-${id}" class="h-full progress-gradient rounded-full transition-all duration-300" style="width: 0%"></div>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span id="status-${id}" class="text-primary-600 font-medium">Preparing...</span>
            <span id="speed-${id}" class="text-slate-500">--</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function simulateUpload(file, id) {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadSpeed = 50 + Math.random() * 150; // MB/s (simulated)
  const uploadSpeedBytes = uploadSpeed * 1024 * 1024;
  
  const startTime = Date.now();
  
  const progressEl = document.getElementById(`progress-${id}`);
  const statusEl = document.getElementById(`status-${id}`);
  const speedEl = document.getElementById(`speed-${id}`);
  
  if (!progressEl) return;
  
  const uploadController = { cancelled: false };
  activeUploads.set(id, uploadController);
  
  const updateProgress = () => {
    if (uploadController.cancelled) {
      statusEl.textContent = 'Cancelled';
      statusEl.classList.remove('text-primary-600');
      statusEl.classList.add('text-red-500');
      return;
    }
    
    const elapsed = (Date.now() - startTime) / 1000;
    const uploadedBytes = Math.min(file.size, uploadSpeedBytes * elapsed);
    const progress = (uploadedBytes / file.size) * 100;
    
    progressEl.style.width = `${progress}%`;
    
    const currentChunk = Math.floor((uploadedBytes / CHUNK_SIZE)) + 1;
    const actualChunks = Math.min(currentChunk, totalChunks);
    
    if (progress < 100) {
      const remainingBytes = file.size - uploadedBytes;
      const remainingTime = remainingBytes / uploadSpeedBytes;
      
      if (file.size > 1024 * 1024 * 1024) {
        statusEl.textContent = `Chunk ${actualChunks}/${totalChunks} • ${progress.toFixed(1)}%`;
      } else {
        statusEl.textContent = `Uploading... ${progress.toFixed(1)}%`;
      }
      
      speedEl.textContent = `${uploadSpeed.toFixed(0)} MB/s • ${formatTimeRemaining(remainingTime)} left`;
      
      requestAnimationFrame(updateProgress);
    } else {
      progressEl.style.width = '100%';
      progressEl.classList.remove('progress-gradient');
      progressEl.classList.add('bg-green-500');
      statusEl.textContent = 'Complete';
      statusEl.classList.remove('text-primary-600');
      statusEl.classList.add('text-green-600');
      speedEl.textContent = `Uploaded in ${elapsed.toFixed(1)}s`;
      
      activeUploads.delete(id);
      
      // Fade out completed upload after delay
      setTimeout(() => {
        const element = document.getElementById(`upload-${id}`);
        if (element) {
          element.style.opacity = '0.5';
        }
      }, 5000);
    }
  };
  
  statusEl.textContent = file.size > 1024 * 1024 * 1024 ? 'Initializing chunked transfer...' : 'Starting upload...';
  requestAnimationFrame(updateProgress);
}

function cancelUpload(id) {
  const controller = activeUploads.get(id);
  if (controller) {
    controller.cancelled = true;
    activeUploads.delete(id);
  }
  
  const element = document.getElementById(`upload-${id}`);
  if (element) {
    element.style.opacity = '0.5';
    setTimeout(() => {
      element.remove();
      if (uploadsList.children.length === 0) {
        uploadsSection.classList.add('hidden');
      }
    }, 300);
  }
}

function cancelAllUploads() {
  activeUploads.forEach((controller, id) => {
    controller.cancelled = true;
    cancelUpload(id);
  });
  activeUploads.clear();
}

// Event Listeners

// Main drop zone click
dropZone.addEventListener('click', openUploadModal);

// Modal drop zone click
modalDropZone.addEventListener('click', (e) => {
  if (e.target.tagName !== 'BUTTON') {
    fileInput.click();
  }
});

// File input change
fileInput.addEventListener('change', (e) => {
  handleFiles(e.target.files);
  fileInput.value = '';
});

// Drag and drop for main zone
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
});

dropZone.addEventListener('dragenter', () => dropZone.classList.add('dragover'));
dropZone.addEventListener('dragover', () => dropZone.classList.add('dragover'));
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  dropZone.classList.remove('dragover');
  openUploadModal();
  handleFiles(e.dataTransfer.files);
});

// Drag and drop for modal zone
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  modalDropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
});

modalDropZone.addEventListener('dragenter', () => modalDropZone.classList.add('dragover'));
modalDropZone.addEventListener('dragover', () => modalDropZone.classList.add('dragover'));
modalDropZone.addEventListener('dragleave', () => modalDropZone.classList.remove('dragover'));
modalDropZone.addEventListener('drop', (e) => {
  modalDropZone.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});

// Modal backdrop click
uploadModal.addEventListener('click', (e) => {
  if (e.target === uploadModal) {
    closeUploadModal();
  }
});

// Escape key to close modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !uploadModal.classList.contains('hidden')) {
    closeUploadModal();
  }
});

// Prevent default drag on document
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  document.body.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
});

// Global highlight on drag
document.body.addEventListener('dragenter', () => {
  dropZone.classList.add('dragover');
});

document.body.addEventListener('dragleave', (e) => {
  if (!e.relatedTarget || e.relatedTarget === document.documentElement) {
    dropZone.classList.remove('dragover');
  }
});

// Make functions globally available
window.openUploadModal = openUploadModal;
window.closeUploadModal = closeUploadModal;
window.removeFile = removeFile;
window.startUpload = startUpload;
window.cancelUpload = cancelUpload;
window.cancelAllUploads = cancelAllUploads;