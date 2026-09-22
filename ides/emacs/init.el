;;; init.el --- Emacs config for fzl-fund-appshell--lit (Lit + Vite + Vitest)
;;
;; Usage:
;;   emacs -q -l /path/to/fzl-fund-appshell--lit/ides/emacs/init.el
;;
;; Or define a shell alias in your shell rc:
;;   alias emacs-appshell='emacs -q -l ~/path/to/fzl-fund-appshell--lit/ides/emacs/init.el'
;;
;; Stack covered: Lit 3 web components in plain ES-module JavaScript
;; (html`...` / css`...` tagged templates), Material Web, Vite 8 +
;; vite-plugin-pwa, Vitest, CSS, HTML, bash scripts under scripts/,
;; .env files and the Portuguese-language docs (roadmap.org,
;; documentation/*.org / *.md).


;;; ---------------------------------------------------------------
;; 0a. Native compiler — silence false-positive warnings
;;     When packages are compiled to native code for the first time,
;;     the async compiler processes each file in isolation and cannot
;;     resolve cross-file forward references.  These warnings do not
;;     affect runtime behavior.  Setting this variable to 'silent
;;     keeps native compilation active while suppressing the noise.
;;; ---------------------------------------------------------------

(setq native-comp-async-report-warnings-errors 'silent)


;;; ---------------------------------------------------------------
;; 0b. Package bootstrap (straight.el + use-package)
;;     All packages land in a local .emacs-appshell/ cache beside
;;     this file, keeping the system Emacs config untouched.
;;; ---------------------------------------------------------------

(defconst appshell/config-dir
  (file-name-directory (or load-file-name buffer-file-name))
  "Directory that contains this init.el.")

(defconst appshell/project-root
  (expand-file-name "../../" appshell/config-dir)
  "Repository root — where package.json and vite.config.js live.")

(defconst appshell/cache-dir
  (expand-file-name ".emacs-appshell/" appshell/config-dir)
  "Local package cache — keeps the system ~/.emacs.d clean.")

;; Redirect all Emacs ephemeral files into the local cache
(setq user-emacs-directory appshell/cache-dir)
(setq package-user-dir (expand-file-name "elpa/" appshell/cache-dir))

;; Bootstrap straight.el
(defvar bootstrap-version)
(let ((bootstrap-file
       (expand-file-name "straight/repos/straight.el/bootstrap.el"
                         appshell/cache-dir))
      (bootstrap-version 7))
  (unless (file-exists-p bootstrap-file)
    (with-current-buffer
        (url-retrieve-synchronously
         "https://raw.githubusercontent.com/radian-software/straight.el/develop/install.el"
         'silent 'inhibit-cookies)
      (goto-char (point-max))
      (eval-print-last-sexp)))
  (load bootstrap-file nil 'nomessage))

(straight-use-package 'use-package)
;; straight.el installs every use-package form by default.  The
;; package.el-based `use-package-always-ensure' is deliberately left
;; off: with it, built-ins declared with `:straight nil' (treesit,
;; eglot, flymake, org...) would still be looked up on ELPA.
(setq straight-use-package-by-default t)


;;; ---------------------------------------------------------------
;; 1. Node tooling on PATH
;;    node_modules/.bin holds the project-local vite and vitest, so
;;    they are found without npx.  ~/.npm-global/bin is where
;;    `npm install -g' puts the language servers of section 8 on this
;;    machine (npm's prefix is set to ~/.npm-global, no sudo needed).
;;; ---------------------------------------------------------------

(dolist (dir (list (expand-file-name "~/.npm-global/bin/")
                   (expand-file-name "node_modules/.bin/" appshell/project-root)))
  (when (file-directory-p dir)
    (add-to-list 'exec-path dir)
    (setenv "PATH" (concat dir ":" (getenv "PATH")))))


;;; ---------------------------------------------------------------
;; 2. Core UI / UX
;;; ---------------------------------------------------------------

(setq inhibit-startup-screen t
      initial-scratch-message nil
      ring-bell-function 'ignore)

(menu-bar-mode   1)    ; on, to host the "AppShell" menu (section 11)
(tool-bar-mode   -1)
(scroll-bar-mode -1)
(column-number-mode 1)
(global-display-line-numbers-mode 1)
(show-paren-mode 1)
(electric-pair-mode 1)       ; closes (), [], {}, '' and the backticks of html`...`
(global-auto-revert-mode 1)  ; files rewritten by scripts/ or git stay in sync

;; Sensible defaults — the project's style is 2-space indentation,
;; single quotes and no semicolons (see src/).
(setq-default indent-tabs-mode nil
              fill-column 100)
(setq sentence-end-double-space nil
      require-final-newline t
      js-indent-level 2
      css-indent-offset 2
      sh-basic-offset 2)

;; Keep backup and auto-save files out of the project tree — Vite's
;; file watcher would otherwise pick up every #foo.js# and ~ file.
(setq backup-directory-alist
      `(("." . ,(expand-file-name "backups/" appshell/cache-dir)))
      auto-save-file-name-transforms
      `((".*" ,(expand-file-name "auto-save/" appshell/cache-dir) t))
      ;; .#foo.js lock symlinks confuse Vite's watcher as well
      create-lockfiles nil)

;; Unlike backup-directory-alist, Emacs does not auto-create the
;; auto-save directory, so it must be created explicitly here.
(make-directory (expand-file-name "auto-save/" appshell/cache-dir) t)


;;; ---------------------------------------------------------------
;; 3. Fonts — buffer and UI text only
;;    Tries a list of Nerd Fonts commonly unpacked by hand into
;;    ~/.local/share/fonts, falling back to DejaVu Sans Mono, which
;;    ships with Fedora.  Purely cosmetic; treemacs' icons use a
;;    separate symbols-only font — see section 13.
;;; ---------------------------------------------------------------

(defun appshell/set-font ()
  "Set the default and fixed-pitch face to the first available font."
  (let ((font (seq-find (lambda (f) (member f (font-family-list)))
                        '("FiraCode Nerd Font Mono"
                          "JetBrainsMono Nerd Font Mono"
                          "Hack Nerd Font Mono"
                          "CaskaydiaCove Nerd Font Mono"
                          "Cascadia Mono NF"
                          "DejaVu Sans Mono"))))
    (when font
      (set-face-attribute 'default nil :family font :height 110)
      (set-face-attribute 'fixed-pitch nil :family font :height 110))))

(add-hook 'after-init-hook #'appshell/set-font)


;;; ---------------------------------------------------------------
;; 4. Theme
;;; ---------------------------------------------------------------

(use-package modus-themes
  :config
  (modus-themes-load-theme 'modus-operandi))   ; light theme, easy on the eyes
                                                ; swap for 'modus-vivendi for dark


;;; ---------------------------------------------------------------
;; 5. Completion framework (Vertico + Orderless + Marginalia)
;;; ---------------------------------------------------------------

(use-package vertico
  :init (vertico-mode 1))

(use-package orderless
  :custom
  (completion-styles '(orderless basic))
  (completion-category-overrides '((file (styles basic partial-completion)))))

(use-package marginalia
  :init (marginalia-mode 1))


;;; ---------------------------------------------------------------
;; 5b. In-buffer completion popup (Corfu + Cape)
;;
;;     Corfu is only the front-end: it renders whatever
;;     `completion-at-point-functions' offers.  In JS/CSS/HTML buffers
;;     that is Eglot (section 8) — members after ".", imports, Lit
;;     element properties, CSS properties and custom properties.  Cape
;;     adds what no language server provides: words from other open
;;     buffers and relative file paths (import './router.js').
;;; ---------------------------------------------------------------

(use-package corfu
  :init
  (global-corfu-mode 1)
  :custom
  (corfu-cycle t)
  (corfu-quit-no-match t)      ; get out of the way as soon as nothing matches
  (corfu-on-exact-match nil)   ; typing a complete word must not self-expand
  ;; First candidate highlighted straight away, so accepting it is a
  ;; single TAB.  Only safe because RET is unbound below — otherwise
  ;; every Enter at the end of a line would silently complete a word.
  (corfu-preselect 'first)
  ;; Don't write the highlighted candidate into the buffer as a preview:
  ;; the buffer must not change until TAB is pressed.
  (corfu-preview-current nil)
  :bind
  (:map corfu-map
        ("RET"    . nil)       ; Enter stays Enter, popup or no popup
        ([return] . nil)
        ("TAB"    . corfu-insert)
        ([tab]    . corfu-insert)
        ("C-n"    . corfu-next)
        ("C-p"    . corfu-previous)
        ("C-g"    . corfu-quit))
  :config
  ;; Since Corfu 2.8 the auto-completion engine is a separate file;
  ;; requiring it is what brings the variables below into existence.
  (require 'corfu-auto)
  (setq corfu-auto t                ; popup appears by itself, no C-M-i needed
        corfu-auto-delay 0.2
        corfu-auto-prefix 2)

  ;; A trigger character bypasses `corfu-auto-prefix' and opens the
  ;; popup on the very next keystroke.  In code that is "." (member
  ;; access: this._now.) — set buffer-locally so prose buffers don't
  ;; pop up a list after every full stop.
  (defun appshell/corfu-code-triggers ()
    (setq-local corfu-auto-trigger "."))
  (add-hook 'prog-mode-hook #'appshell/corfu-code-triggers)

  ;; Side panel showing the documentation of the highlighted candidate
  ;; (JSDoc / MDN text from the language server).
  (require 'corfu-popupinfo)
  (corfu-popupinfo-mode 1)
  (setq corfu-popupinfo-delay '(0.5 . 0.3)))

;; NOTE: Corfu draws its popup in a child frame, which on Emacs 30 is
;; graphical-only — under `emacs -nw' the popup never appears (the fix
;; there is the corfu-terminal package, left out since this config is
;; launched graphically).

(use-package cape
  ;; Loaded eagerly: the options below are defcustoms that only exist
  ;; once cape.el is loaded.
  :demand t
  :init
  (defun appshell/capf-setup ()
    "Add file-path and dabbrev completion to the current buffer.
Appended with a high depth so they sit *after* Eglot's own entry:
member completion must always come from the language server."
    (add-hook 'completion-at-point-functions #'cape-file    90 t)
    (add-hook 'completion-at-point-functions #'cape-dabbrev 95 t))
  (add-hook 'prog-mode-hook #'appshell/capf-setup)
  (add-hook 'text-mode-hook #'appshell/capf-setup)
  :custom
  ;; Component and service names get retyped across src/, so candidates
  ;; come from every buffer of the same major mode.
  (cape-dabbrev-buffer-function #'cape-same-mode-buffers)
  ;; `cape-file' only offers itself once the text at point holds a "/"
  ;; whose parent directory exists — the import './services/...' case.
  (cape-file-directory-must-exist t))


;;; ---------------------------------------------------------------
;; 6. Tree-sitter major modes (built into Emacs 30)
;;    Grammars are compiled into .emacs-appshell/tree-sitter/ on the
;;    first launch (needs gcc — already on Fedora).  Revisions are
;;    pinned: newer upstream grammars renamed nodes that the
;;    font-lock queries of Emacs 30's js-ts-mode / css-ts-mode still
;;    use, which shows up as "invalid node type" errors on open.
;;; ---------------------------------------------------------------

(use-package treesit
  :straight nil
  :init
  (setq treesit-language-source-alist
        '((javascript "https://github.com/tree-sitter/tree-sitter-javascript" "v0.23.1" "src")
          (jsdoc      "https://github.com/tree-sitter/tree-sitter-jsdoc"      "v0.23.2" "src")
          (css        "https://github.com/tree-sitter/tree-sitter-css"        "v0.23.1" "src")
          (html       "https://github.com/tree-sitter/tree-sitter-html"       "v0.23.2" "src")
          (json       "https://github.com/tree-sitter/tree-sitter-json"       "v0.24.8" "src")
          (bash       "https://github.com/tree-sitter/tree-sitter-bash"       "v0.23.3" "src")))
  ;; Maximum highlighting: also colours properties, operators and
  ;; function calls, which helps in long render() methods.
  (setq treesit-font-lock-level 4)
  :config
  (dolist (lang (mapcar #'car treesit-language-source-alist))
    (unless (treesit-language-available-p lang)
      (message "Tree-sitter: compiling the %s grammar (first run only)..." lang)
      (condition-case err
          (treesit-install-language-grammar lang)
        (error (message "Tree-sitter: could not build %s grammar: %s"
                        lang (error-message-string err))))))

  ;; Only remap to a -ts-mode when its grammar actually loaded, so a
  ;; failed build degrades to the classic mode instead of breaking.
  ;; auto-mode-alist names .js files `javascript-mode' (an alias), and
  ;; remapping matches the symbol literally, so both need an entry.
  (dolist (remap '((javascript js-mode   js-ts-mode)
                   (javascript javascript-mode js-ts-mode)
                   (css        css-mode  css-ts-mode)
                   (html       mhtml-mode html-ts-mode)
                   (json       js-json-mode json-ts-mode)
                   (bash       sh-mode   bash-ts-mode)))
    (pcase-let ((`(,lang ,from ,to) remap))
      (when (treesit-language-available-p lang)
        (add-to-list 'major-mode-remap-alist (cons from to))))))

;; .mjs (scripts/generate-icons.mjs) and .cjs are plain JS too.
(add-to-list 'auto-mode-alist '("\\.[cm]js\\'" . js-mode))
;; .webmanifest emitted by vite-plugin-pwa is JSON.
(add-to-list 'auto-mode-alist '("\\.webmanifest\\'" . js-json-mode))


;;; ---------------------------------------------------------------
;; 7. Lit tagged templates — edit html`...` / css`...` in their own mode
;;
;;    js-ts-mode sees a Lit template as one opaque string: no HTML or
;;    CSS highlighting, indentation or completion inside it.  With
;;    point anywhere inside html`...`, svg`...` or css`...`, press
;;    C-c ' to open just that template in an indirect buffer running
;;    html-ts-mode / css-ts-mode (with Emmet in HTML).  C-c C-c writes
;;    it back, C-c C-k discards.  ${...} interpolations are kept as-is.
;;    The ts-lit-plugin wired up in section 8 additionally gives type
;;    checking and completion inside templates without leaving the JS
;;    buffer.
;;; ---------------------------------------------------------------

(use-package edit-indirect)

(use-package emmet-mode
  :hook ((html-ts-mode mhtml-mode) . emmet-mode))

(defconst appshell/lit-tag-modes
  '(("html" . (html-ts-mode . mhtml-mode))
    ("svg"  . (html-ts-mode . mhtml-mode))
    ("css"  . (css-ts-mode  . css-mode)))
  "Lit template tag → (tree-sitter mode . fallback mode) used to edit it.")

(defun appshell/lit-template-at-point ()
  "Return (TAG BEG END) for the Lit tagged template around point, or nil.
BEG and END delimit the text between the backticks."
  (let ((node (and (treesit-parser-list) (treesit-node-at (point))))
        found)
    (while (and node (not found))
      (if (equal (treesit-node-type node) "template_string")
          (let* ((call (treesit-node-parent node))
                 (fn (and call
                          (equal (treesit-node-type call) "call_expression")
                          (treesit-node-child-by-field-name call "function"))))
            (if (and fn (assoc (treesit-node-text fn t) appshell/lit-tag-modes))
                (setq found (list (treesit-node-text fn t)
                                  (1+ (treesit-node-start node))
                                  (1- (treesit-node-end node))))
              (setq node (treesit-node-parent node))))
        (setq node (treesit-node-parent node))))
    found))

(defun appshell/edit-lit-template ()
  "Edit the Lit html`...` / svg`...` / css`...` template at point in its own mode."
  (interactive)
  (pcase (appshell/lit-template-at-point)
    (`(,tag ,beg ,end)
     (let* ((modes (alist-get tag appshell/lit-tag-modes nil nil #'string=))
            (mode (if (treesit-language-available-p
                       (if (eq (car modes) 'css-ts-mode) 'css 'html))
                      (car modes)
                    (cdr modes)))
            (edit-indirect-guess-mode-function
             (lambda (_parent _beg _end) (funcall mode))))
       (edit-indirect-region beg end t)))
    (_ (user-error "Point is not inside a Lit html`...`, svg`...` or css`...` template"))))

(with-eval-after-load 'js
  (define-key js-ts-mode-map (kbd "C-c '") #'appshell/edit-lit-template))


;;; ---------------------------------------------------------------
;; 8. Eglot — language servers (built into Emacs 30)
;;
;;    JS        typescript-language-server (+ ts-lit-plugin for Lit
;;              templates: unknown elements/attributes, bindings, CSS)
;;    CSS/HTML  vscode-css/html-language-server (vscode-langservers-extracted)
;;    bash      bash-language-server (uses shellcheck when installed)
;;
;;    None of these are project dependencies.  Install them all once
;;    with M-x appshell/install-language-servers (npm -g, no sudo on
;;    this machine).  Until then Eglot simply isn't started and the
;;    buffer still works with tree-sitter + dabbrev completion.
;;; ---------------------------------------------------------------

(defconst appshell/language-server-packages
  '("typescript" "typescript-language-server" "ts-lit-plugin"
    "vscode-langservers-extracted" "bash-language-server")
  "Global npm packages providing the language servers used below.")

(defun appshell/install-language-servers ()
  "Install the language servers of section 8 with npm -g."
  (interactive)
  (appshell/run "install-lsp"
                (concat "npm install -g "
                        (string-join appshell/language-server-packages " "))))

(defun appshell/ts-ls-contact (&optional _interactive _project)
  "Eglot contact for typescript-language-server, with ts-lit-plugin if installed."
  (let* ((npm-root (string-trim
                    (shell-command-to-string "npm root -g 2>/dev/null")))
         (lit-plugin (expand-file-name "ts-lit-plugin" npm-root)))
    (if (file-directory-p lit-plugin)
        `("typescript-language-server" "--stdio"
          :initializationOptions
          (:plugins [(:name "ts-lit-plugin" :location ,lit-plugin)]))
      '("typescript-language-server" "--stdio"))))

(defconst appshell/eglot-servers
  '((js-ts-mode   . "typescript-language-server")
    (js-mode      . "typescript-language-server")
    (css-ts-mode  . "vscode-css-language-server")
    (css-mode     . "vscode-css-language-server")
    (html-ts-mode . "vscode-html-language-server")
    (mhtml-mode   . "vscode-html-language-server")
    (bash-ts-mode . "bash-language-server")
    (sh-mode      . "bash-language-server"))
  "Major mode → executable Eglot needs for it.")

(defun appshell/eglot-maybe ()
  "Start Eglot in file-visiting buffers whose language server is installed.
Indirect buffers from C-c ' (section 7) have no file and are skipped."
  (let ((server (alist-get major-mode appshell/eglot-servers)))
    (cond
     ((not (and buffer-file-name server)))
     ((executable-find server) (eglot-ensure))
     (t (message "Eglot: %s not installed — M-x appshell/install-language-servers"
                 server)))))

(use-package eglot
  :straight nil
  :hook ((js-ts-mode js-mode css-ts-mode css-mode html-ts-mode mhtml-mode
          bash-ts-mode sh-mode)
         . appshell/eglot-maybe)
  :bind
  (:map eglot-mode-map
        ("C-c l r" . eglot-rename)
        ("C-c l a" . eglot-code-actions)
        ("C-c l o" . eglot-code-action-organize-imports)
        ("C-c l f" . eglot-format)
        ("C-c l d" . eldoc-doc-buffer))
  :custom
  (eglot-autoshutdown t)                ; kill the server with its last buffer
  (eglot-events-buffer-config '(:size 0)) ; no JSON-RPC log — faster
  (eglot-extend-to-xref t)              ; M-. into node_modules/lit stays in Eglot
  :config
  (add-to-list 'eglot-server-programs
               '((js-ts-mode js-mode) . appshell/ts-ls-contact)))


;;; ---------------------------------------------------------------
;; 9. Flymake — inline diagnostics
;;    Eglot feeds Flymake in JS/CSS/HTML.  For the bash scripts, Emacs'
;;    own sh-shellcheck-flymake backend works even without Eglot, once
;;    shellcheck is present:  sudo dnf install ShellCheck
;;; ---------------------------------------------------------------

(use-package flymake
  :straight nil
  :hook ((bash-ts-mode sh-mode) . (lambda ()
                                    (when (executable-find "shellcheck")
                                      (flymake-mode 1))))
  :bind
  (:map flymake-mode-map
        ("M-n" . flymake-goto-next-error)
        ("M-p" . flymake-goto-prev-error)
        ("C-c ! l" . flymake-show-buffer-diagnostics)
        ("C-c ! p" . flymake-show-project-diagnostics)))


;;; ---------------------------------------------------------------
;; 10. Flyspell — spell checking (Brazilian Portuguese + English)
;;     Comments, docs and UI strings are in pt-BR while identifiers
;;     are English, so hunspell runs with both dictionaries at once.
;;     In code only comments/JSDoc are checked — Lit templates are
;;     strings, and checking them would flag every tag and attribute.
;;     Install: sudo dnf install hunspell hunspell-pt-BR hunspell-en-US
;;; ---------------------------------------------------------------

(use-package flyspell
  :straight nil
  :hook
  ((org-mode markdown-mode) . flyspell-mode)
  (prog-mode . flyspell-prog-mode)
  :custom
  (ispell-program-name "hunspell")
  (flyspell-prog-text-faces '(font-lock-comment-face font-lock-doc-face))
  (flyspell-issue-message-flag nil)
  :config
  (require 'ispell)
  (ispell-set-spellchecker-params)
  (ispell-hunspell-add-multi-dic "pt_BR,en_US")
  (setq ispell-dictionary "pt_BR,en_US")  ; switch with M-x ispell-change-dictionary
  ;; Flyspell only marks a word once point passes over it; force a full
  ;; check of prose buffers when the mode turns on, so roadmap.org's
  ;; existing typos are visible just by scrolling.
  (add-hook 'flyspell-mode-hook
            (lambda ()
              (when (and flyspell-mode (derived-mode-p 'text-mode))
                (flyspell-buffer)))))


;;; ---------------------------------------------------------------
;; 11. AppShell commands — npm scripts, Vite dev server, Vitest
;;     Everything runs from the repo root in a compilation buffer,
;;     so failing tests and build errors are clickable (RET / M-g n)
;;     and jump straight to file:line.
;;; ---------------------------------------------------------------

(use-package compile
  :straight nil
  :custom
  (compilation-scroll-output 'first-error)
  (compilation-max-output-line-length nil)
  :config
  ;; Vite and Vitest print ANSI colours; render them instead of
  ;; showing raw escape codes.
  (add-hook 'compilation-filter-hook #'ansi-color-compilation-filter)
  ;; Vitest failure frames:   ❯ src/router.test.js:15:30
  ;; Vite/Rollup build error: file: /abs/path/src/router.js:12:3
  (add-to-list 'compilation-error-regexp-alist-alist
               '(vitest "❯ \\([^ \n:]+\\.[cm]?[jt]s\\):\\([0-9]+\\):\\([0-9]+\\)" 1 2 3))
  (add-to-list 'compilation-error-regexp-alist-alist
               '(vite "file: \\(/[^ \n:]+\\):\\([0-9]+\\):\\([0-9]+\\)" 1 2 3))
  (add-to-list 'compilation-error-regexp-alist 'vitest)
  (add-to-list 'compilation-error-regexp-alist 'vite))

(defun appshell/run (name command &optional comint)
  "Run shell COMMAND from the repo root in buffer *appshell: NAME*.
With COMINT non-nil the buffer accepts input, for interactive scripts."
  (let ((default-directory appshell/project-root)
        (compilation-buffer-name-function
         (lambda (_mode) (format "*appshell: %s*" name))))
    (compile command comint)))

(defun appshell/npm-scripts ()
  "Return the script names declared in package.json."
  (with-temp-buffer
    (insert-file-contents (expand-file-name "package.json" appshell/project-root))
    (mapcar (lambda (entry) (symbol-name (car entry)))
            (alist-get 'scripts (json-parse-buffer :object-type 'alist)))))

(defun appshell/npm-run (script)
  "Run any npm SCRIPT from package.json, chosen with completion.
Runs in a comint buffer, since the vars:* / ga4:* scripts prompt for input."
  (interactive (list (completing-read "npm run: " (appshell/npm-scripts) nil t)))
  (appshell/run script (format "npm run %s" script) t))

(defun appshell/dev ()
  "Start the Vite dev server (npm run dev)."
  (interactive)
  (appshell/run "dev" "npm run dev" t))

(defun appshell/dev-stop ()
  "Stop the Vite dev server started by `appshell/dev'."
  (interactive)
  (let ((proc (get-buffer-process "*appshell: dev*")))
    (if proc
        (progn (interrupt-process proc) (message "AppShell: dev server stopped."))
      (message "AppShell: dev server is not running."))))

(defun appshell/open-browser ()
  "Open the running dev/preview server in the browser.
Reads the actual URL Vite printed (it moves to 5174... when 5173 is
taken), falling back to Vite's default dev port."
  (interactive)
  (browse-url
   (or (seq-some
        (lambda (name)
          (when-let ((buf (get-buffer name)))
            (with-current-buffer buf
              (save-excursion
                (goto-char (point-max))
                (when (re-search-backward "Local: +\\(https?://[^ \n]+\\)" nil t)
                  (match-string-no-properties 1))))))
        '("*appshell: dev*" "*appshell: preview*"))
       "http://localhost:5173/")))

(defun appshell/build ()
  "Production build (npm run build → dist/)."
  (interactive)
  (appshell/run "build" "npm run build"))

(defun appshell/preview ()
  "Build and serve dist/ locally (npm run serve), to test the PWA/service worker."
  (interactive)
  (appshell/run "preview" "npm run serve" t))

(defun appshell/test ()
  "Run the whole Vitest suite once (npm test)."
  (interactive)
  (appshell/run "test" "npm test"))

(defun appshell/test-watch ()
  "Run Vitest in watch mode (npm run test:watch)."
  (interactive)
  (appshell/run "test:watch" "npm run test:watch" t))

(defun appshell/test-file ()
  "Run Vitest for the current file.
From foo.js runs its sibling foo.test.js; from foo.test.js runs itself."
  (interactive)
  (let* ((file (or buffer-file-name (user-error "Buffer is not visiting a file")))
         (test (if (string-match-p "\\.test\\.[cm]?js\\'" file)
                   file
                 (replace-regexp-in-string "\\.\\([cm]?js\\)\\'" ".test.\\1" file))))
    (unless (file-exists-p test)
      (user-error "No test file %s" (file-relative-name test appshell/project-root)))
    (appshell/run "test" (format "npm test -- %s"
                                 (shell-quote-argument
                                  (file-relative-name test appshell/project-root))))))

(defvar-keymap appshell/command-map
  :doc "AppShell project commands (C-c a)."
  "d" #'appshell/dev
  "s" #'appshell/dev-stop
  "o" #'appshell/open-browser
  "b" #'appshell/build
  "p" #'appshell/preview
  "t" #'appshell/test
  "f" #'appshell/test-file
  "w" #'appshell/test-watch
  "n" #'appshell/npm-run
  "L" #'appshell/install-language-servers)
(keymap-global-set "C-c a" appshell/command-map)

(easy-menu-define appshell/menu global-map "AppShell project commands."
  '("AppShell"
    ["Dev server (npm run dev)"      appshell/dev t]
    ["Stop dev server"               appshell/dev-stop t]
    ["Open in browser"               appshell/open-browser t]
    "--"
    ["Build (npm run build)"         appshell/build t]
    ["Build + preview (npm run serve)" appshell/preview t]
    "--"
    ["Run all tests (Vitest)"        appshell/test t]
    ["Test current file"             appshell/test-file buffer-file-name]
    ["Tests in watch mode"           appshell/test-watch t]
    "--"
    ["Run npm script..."             appshell/npm-run t]
    ["Edit Lit template at point"    appshell/edit-lit-template (derived-mode-p 'js-ts-mode)]
    ["Install language servers"      appshell/install-language-servers t]))


;;; ---------------------------------------------------------------
;; 12. Other file types in the repo
;;; ---------------------------------------------------------------

;; .env, .env.example, .env.local — VITE_* variables
(use-package dotenv-mode
  :mode ("\\.env\\(\\..*\\)?\\'" . dotenv-mode))

;; documentation/deploy.md
(use-package markdown-mode
  :mode ("\\.md\\'" . gfm-mode)
  :hook (markdown-mode . visual-line-mode))

;; roadmap.org, documentation/features.org, scripts/*.org
(use-package org
  :straight nil
  :mode ("\\.org\\'" . org-mode)
  :hook (org-mode . visual-line-mode)
  :custom
  (org-startup-folded 'content)
  (org-hide-leading-stars t)
  (org-src-fontify-natively t)
  (org-src-tab-acts-natively t))


;;; ---------------------------------------------------------------
;; 13. Project navigation — project.el pointing at the repo root
;;     C-x p f finds files honoring .gitignore (node_modules, dist and
;;     /temp are excluded); C-x p g greps the project.
;;; ---------------------------------------------------------------

(use-package project
  :straight nil
  :config
  ;; Register the repo root directly as a Git project.
  (when (file-directory-p (expand-file-name ".git" appshell/project-root))
    (project-remember-project `(vc Git ,appshell/project-root))))


;;; ---------------------------------------------------------------
;; 14. Magit — Git porcelain
;;; ---------------------------------------------------------------

(use-package magit
  :bind
  ("C-x g" . magit-status))


;;; ---------------------------------------------------------------
;; 15. Treemacs — file/directory sidebar
;;; ---------------------------------------------------------------

(use-package treemacs
  :bind
  (("<f8>"      . treemacs-select-window)
   ("M-0"       . treemacs-select-window)
   ("C-x t t"   . treemacs)
   ("C-x t d"   . treemacs-select-directory)
   ("C-x t B"   . treemacs-bookmark)
   ("C-x t C-t" . treemacs-find-file)
   ("C-x t M-t" . treemacs-find-tag))
  :custom
  (treemacs-width 35)
  (treemacs-is-never-other-window t)
  (treemacs-sorting 'alphabetic-case-insensitive-asc)
  :config
  (treemacs-follow-mode t)
  (treemacs-filewatch-mode t)
  (treemacs-fringe-indicator-mode 'always)
  (treemacs-git-mode 'deferred))

(use-package treemacs-nerd-icons
  :after treemacs
  :config
  ;; Icons are drawn in `nerd-icons-font-family' ("Symbols Nerd Font
  ;; Mono"), independent from the editing font of section 3.  Install
  ;; it once with M-x nerd-icons-install-fonts; until then, stay on
  ;; treemacs' built-in theme rather than filling the sidebar with tofu.
  (cond
   ((not (display-graphic-p))
    (treemacs-load-theme "nerd-icons"))
   ((find-font (font-spec :family nerd-icons-font-family))
    (treemacs-load-theme "nerd-icons"))
   (t
    (message "Treemacs: font %S not installed — run M-x nerd-icons-install-fonts to get icons"
             nerd-icons-font-family))))

;; Open treemacs automatically at startup, pointed at the repo root,
;; via project.el (section 13) so it never prompts for a root path.
(add-hook 'emacs-startup-hook
          (lambda ()
            (let ((default-directory appshell/project-root))
              (treemacs-add-and-display-current-project-exclusively))))


;;; ---------------------------------------------------------------
;; 16. Useful keybindings summary
;;
;;  AppShell (C-c a prefix — also in the "AppShell" menu):
;;    C-c a d       — start the Vite dev server       (*appshell: dev*)
;;    C-c a s       — stop the dev server
;;    C-c a o       — open the running dev/preview URL in the browser
;;    C-c a b       — npm run build → dist/
;;    C-c a p       — npm run serve (build + preview, tests the PWA)
;;    C-c a t       — run the whole Vitest suite
;;    C-c a f       — run Vitest for the current file (or its .test.js)
;;    C-c a w       — Vitest in watch mode
;;    C-c a n       — pick and run any package.json script
;;    C-c a L       — npm -g install the language servers (one-time)
;;    In *appshell: ...* buffers: RET on an error / M-g n jumps to file:line.
;;
;;  JavaScript / Lit (js-ts-mode):
;;    C-c '         — edit the html`...` / css`...` template at point in
;;                    html-ts-mode / css-ts-mode; C-c C-c commits, C-c C-k aborts
;;    M-. / M-,     — go to definition (also into node_modules/lit) / back
;;    M-?           — find references
;;    C-c l r       — rename symbol
;;    C-c l a       — code actions (quick fixes, add missing import)
;;    C-c l o       — organize imports
;;    C-c l f       — format buffer/region with the language server
;;    C-c l d       — full documentation for the symbol at point
;;    M-n / M-p     — next / previous diagnostic (Flymake)
;;    C-c ! l / p   — list diagnostics for buffer / project
;;
;;  HTML (html-ts-mode, incl. the C-c ' template buffer):
;;    C-j           — expand an Emmet abbreviation, e.g. md-filled-button.x>span
;;
;;  Autocomplete popup (Corfu — appears by itself while typing):
;;    TAB           — accept the highlighted candidate
;;    C-n / C-p     — next / previous candidate (arrow keys work too)
;;    RET           — deliberately NOT completion; inserts a newline
;;    C-g           — dismiss the popup
;;    C-M-i         — force the popup open
;;    M-t           — toggle the documentation panel for the candidate
;;
;;  Project:
;;    C-x p f       — find file in project (honors .gitignore)
;;    C-x p g       — grep the project
;;    C-x g         — magit-status
;;
;;  Treemacs (file/directory sidebar, opens automatically at startup):
;;    <f8> / M-0    — jump to the treemacs window
;;    C-x t t       — open/close treemacs
;;    C-x t d       — open treemacs for a chosen directory
;;    C-x t B       — treemacs bookmark
;;    C-x t C-t     — find current file in treemacs
;;; ---------------------------------------------------------------

(provide 'init)
;;; init.el ends here
