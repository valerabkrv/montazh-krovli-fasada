#!/usr/bin/env python3
"""
Сборка сайта «Монтаж кровли и фасада» в код для блока T123 (HTML-код) Тильды.

    python3 tilda/build-t123.py index.html --out tilda/montazh-t123.html \
        --scope mn --base https://valerabkrv.github.io/<репозиторий>/

Сайт собран из внешних файлов (assets/style.css + assets/montazh.css,
assets/data.js, assets/site.js, assets/calc.js), поэтому:
  * все подключённые стили читаются с диска по порядку, из них убираются
    комментарии и на каждый селектор вешается область видимости .<scope> —
    иначе CSS Тильды ломает вёрстку и наоборот. Комментарии убирать
    ОБЯЗАТЕЛЬНО до навешивания: иначе комментарий прилипает к следующему
    селектору и правило умирает;
  * скрипты остаются внешними и лежат на GitHub Pages — вместе с CSS
    они не влезли бы в лимит блока (100 000 байт);
  * теги <script src> Тильда внутри блока не выполняет, поэтому блок сам
    подгружает скрипты по цепочке и запускает рендер в колбэке;
  * пути к картинкам внутри data.js относительные, а страницу отдаёт Тильда,
    поэтому блок заранее объявляет window.MN_ASSET_BASE — site.js склеивает
    его со всеми относительными путями (функция asset()).
"""
import argparse, re, sys, os

KEEP_AS_IS = ('@keyframes', '@font-face', '@charset', '@import')
BOOT_MARK = '/* ---- ЗАПУСК ---- '


def matching_brace(css, j):
    depth = 0
    for k in range(j, len(css)):
        if css[k] == '{':
            depth += 1
        elif css[k] == '}':
            depth -= 1
            if depth == 0:
                return k
    return len(css) - 1


def scope_css(css, scope):
    def prefix(sel):
        out = []
        for p in (x.strip() for x in sel.split(',')):
            if not p:
                continue
            out.append(p if p in (':root', 'html', 'body') else '.%s %s' % (scope, p))
        return ', '.join(out)

    res, i, n = [], 0, len(css)
    while i < n:
        j = css.find('{', i)
        if j == -1:
            res.append(css[i:])
            break
        head = css[i:j].strip()
        if head.startswith('@media') or head.startswith('@supports'):
            k = matching_brace(css, j)
            res.append('\n' + head + '{' + scope_css(css[j + 1:k], scope) + '}')
            i = k + 1
        elif head.startswith(KEEP_AS_IS):
            k = matching_brace(css, j)
            res.append('\n' + css[i:k + 1].strip())
            i = k + 1
        else:
            k = css.find('}', j)
            res.append('\n' + prefix(head) + '{' + css[j + 1:k].strip() + '}')
            i = k + 1
    return ''.join(res)


def build(src_path, scope, base):
    root = os.path.dirname(os.path.abspath(src_path)) or '.'
    src = open(src_path, encoding='utf-8').read()

    body = re.search(r'<body[^>]*>(.*?)</body>', src, re.S)
    if not body:
        sys.exit('Не нашёл <body> в ' + src_path)
    body = body.group(1)

    css_hrefs = re.findall(r'<link rel="stylesheet" href="([^"?]+)', src)
    if not css_hrefs:
        sys.exit('Не нашёл <link rel="stylesheet"> в ' + src_path)
    css = '\n'.join(open(os.path.join(root, h), encoding='utf-8').read() for h in css_hrefs)
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)         # обязательно до scope_css
    css = scope_css(css, scope)

    fonts = re.search(r'(<link rel="preconnect".*?rel="stylesheet">)', src, re.S)
    fonts = fonts.group(1) if fonts else ''

    # 1) внешние скрипты вырезаем — блок подгрузит их сам (см. loader ниже)
    srcs = re.findall(r'<script src="assets/([^"]+)"></script>', body)
    body = re.sub(r'<script src="assets/[^"]+"></script>\s*', '', body)

    # 2) картинки в разметке — на абсолютные адреса Pages
    body = body.replace('src="assets/', 'src="' + base + 'assets/')

    # 3) хвост инлайнового скрипта (после маркера ЗАПУСК) уезжает в колбэк
    i = body.find(BOOT_MARK)
    if i == -1:
        sys.exit('Не нашёл маркер «%s» в %s' % (BOOT_MARK, src_path))
    j = body.find('</script>', i)
    boot = body[body.find('*/', i) + 2:j].strip()
    chain = 'start();'
    for name in reversed(srcs):
        chain = 'load("%sassets/%s", function(){ %s });' % (base, name, chain)
    loader = (
        '\n\n/* Тильда не выполняет <script src> внутри блока — грузим сами,\n'
        '   строго по очереди: site.js и calc.js рассчитывают на готовый data.js. */\n'
        'function load(src, next) {\n'
        '  var s = document.createElement("script");\n'
        '  s.src = src;\n'
        '  s.onload = next;\n'
        '  s.onerror = function () { console.error("Монтаж: не загрузился " + src); };\n'
        '  document.head.appendChild(s);\n'
        '}\n'
        'function start() {\n'
        '%s\n'
        '}\n'
        '%s\n'
    ) % ('\n'.join('  ' + l for l in boot.splitlines()), chain)
    body = body[:i] + loader + body[j:]

    note = ('<!-- Монтаж кровли и фасада — блок T123 для Тильды.\n'
            '     Собрано из index.html скриптом tilda/build-t123.py, руками не править:\n'
            '     правки делаются в исходнике и пересобираются.\n'
            '     Картинки и скрипты: %s\n'
            '     Цены правятся прямо здесь — блок MN_PRICES в самом низу. -->\n' % base)

    boot = ('<script>window.MN_ASSET_BASE = "%s";</script>\n' % base)

    return (note + fonts + '\n<style>' + css + '\n</style>\n' +
            '<div class="%s">\n' % scope + boot + body.strip() + '\n</div>\n')


def check(out, scope, base):
    problems = []
    css = re.search(r'<style>(.*?)</style>', out, re.S).group(1)
    if '/*' in css:
        problems.append('в CSS остались комментарии')
    for sel in re.findall(r'(?m)^([^@{\n][^{\n]*)\{', css):
        s = sel.strip()
        if s.startswith(('from', 'to', '0%', '100%')):
            continue                                   # кадры @keyframes
        if not (s.startswith('.' + scope) or s in (':root', 'html', 'body')
                or s.startswith(('body,', 'html,', ':root,'))):
            problems.append('селектор без области видимости: ' + s[:60])
    if 'src="assets/' in out:
        problems.append('остались относительные пути src="assets/')
    if '<script src=' in out:
        problems.append('остался тег <script src> — в блоке Тильды он не выполнится')
    for need in ('function load(', 'function start(', 'renderCatalog', 'renderCalc', 'MN_PRICES',
                 'calc.js', 'hero-glavnaya'):
        if need not in out:
            problems.append('в блоке нет ' + need)
    if base not in out:
        problems.append('не подставился базовый адрес')
    return problems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('--out', required=True)
    ap.add_argument('--scope', default='mn')
    ap.add_argument('--base', required=True, help='адрес GitHub Pages со слэшем на конце')
    a = ap.parse_args()

    out = build(a.src, a.scope, a.base)
    open(a.out, 'w', encoding='utf-8').write(out)

    size = len(out.encode('utf-8'))
    print('%s — %d байт (лимит T123 = 100 000, запас %d)' % (a.out, size, 100000 - size))
    if size > 100000:
        print('!! НЕ ВЛЕЗЕТ в блок T123 — разбивать на два.')
    problems = check(out, a.scope, a.base)
    for p in problems:
        print('!!', p)
    if not problems:
        print('проверки пройдены')


if __name__ == '__main__':
    main()
