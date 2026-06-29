// Footer template registry — extensible for future theme templates
window.FOOTER_TEMPLATES = {
    classic: {
        id: 'classic',
        name: 'Classic Chips',
        description: 'Gold pill links in a row — the original Swag Stree footer.',
        default: true
    },
    minimal: {
        id: 'minimal',
        name: 'Minimal Strip',
        description: 'Compact text links with subtle dividers — fits narrow screens.'
    },
    stacked: {
        id: 'stacked',
        name: 'Stacked Cards',
        description: 'Full-width tap targets — best readability on mobile.'
    },
    luxury: {
        id: 'luxury',
        name: 'Luxury Bar',
        description: 'Premium gold-accent bar with brand strip and spaced links.'
    },
    grid: {
        id: 'grid',
        name: 'Grid Actions',
        description: 'Equal-size grid buttons — clear and thumb-friendly.'
    }
};

window.FOOTER_LAYOUTS = {
    auto: {
        id: 'auto',
        name: 'Auto',
        description: 'Fixed bar on phone, inline at page bottom on desktop.'
    },
    fixed: {
        id: 'fixed',
        name: 'Fixed Bar',
        description: 'Always pinned above bottom navigation.'
    },
    inline: {
        id: 'inline',
        name: 'Inline Scroll',
        description: 'Footer scrolls with the page — nothing clipped or hidden.'
    }
};

function normalizeFooterTemplateId(id) {
    return FOOTER_TEMPLATES[id] ? id : 'classic';
}

function normalizeFooterLayoutId(id) {
    return FOOTER_LAYOUTS[id] ? id : 'auto';
}

function getFooterLinkItems(settings) {
    const phone = (settings?.contactPhone || '8800467686').trim();
    return [
        { type: 'about', icon: 'fa-circle-info', label: 'About Us', onclick: "openFooterPage('about')" },
        { type: 'call', icon: 'fa-phone', label: 'Call Us', href: 'tel:' + phone },
        { type: 'privacy', icon: 'fa-shield-halved', label: 'Privacy', onclick: "openFooterPage('privacy')" }
    ];
}

function buildFooterLinksHtml(templateId, settings) {
    const tpl = normalizeFooterTemplateId(templateId);
    const items = getFooterLinkItems(settings);

    if (tpl === 'stacked') {
        return `<div class="footer-links-stacked">${items.map(item => {
            if (item.href) {
                return `<a id="footer-contact-link" href="${item.href}" class="footer-stacked-link"><i class="fa ${item.icon}"></i><span>${item.label}</span><i class="fa fa-chevron-right footer-stacked-chevron"></i></a>`;
            }
            return `<button type="button" class="footer-stacked-link" onclick="${item.onclick}"><i class="fa ${item.icon}"></i><span>${item.label}</span><i class="fa fa-chevron-right footer-stacked-chevron"></i></button>`;
        }).join('')}</div>`;
    }

    if (tpl === 'grid') {
        return `<div class="footer-links-grid">${items.map(item => {
            if (item.href) {
                return `<a id="footer-contact-link" href="${item.href}" class="footer-grid-link"><i class="fa ${item.icon}"></i><span>${item.label}</span></a>`;
            }
            return `<button type="button" class="footer-grid-link" onclick="${item.onclick}"><i class="fa ${item.icon}"></i><span>${item.label}</span></button>`;
        }).join('')}</div>`;
    }

    if (tpl === 'minimal') {
        return `<div class="footer-links-minimal">${items.map((item, idx) => {
            const sep = idx > 0 ? '<span class="footer-minimal-sep">·</span>' : '';
            if (item.href) {
                return `${sep}<a id="footer-contact-link" href="${item.href}" class="footer-minimal-link"><i class="fa ${item.icon}"></i> ${item.label}</a>`;
            }
            return `${sep}<button type="button" class="footer-minimal-link" onclick="${item.onclick}"><i class="fa ${item.icon}"></i> ${item.label}</button>`;
        }).join('')}</div>`;
    }

    if (tpl === 'luxury') {
        return `<div class="footer-luxury-brand"><span class="footer-luxury-mark"></span><span id="footer-luxury-brand-text">${settings?.copyright || 'Swag Stree'}</span></div>
            <div class="footer-links-luxury">${items.map(item => {
                if (item.href) {
                    return `<a id="footer-contact-link" href="${item.href}" class="footer-luxury-link"><i class="fa ${item.icon}"></i><span>${item.label}</span></a>`;
                }
                return `<button type="button" class="footer-luxury-link" onclick="${item.onclick}"><i class="fa ${item.icon}"></i><span>${item.label}</span></button>`;
            }).join('')}</div>`;
    }

    // classic (default)
    return `<div id="footer-links-row" class="footer-links-classic">${items.map(item => {
        if (item.href) {
            return `<a id="footer-contact-link" href="${item.href}" class="footer-chip"><i class="fa ${item.icon}"></i> ${item.label}</a>`;
        }
        return `<div onclick="${item.onclick}" class="footer-chip"><i class="fa ${item.icon}"></i> ${item.label}</div>`;
    }).join('')}</div>`;
}

function applyFooterShellClasses(footerEl, templateId, layoutId) {
    if (!footerEl) return;
    const tpl = normalizeFooterTemplateId(templateId);
    const layout = normalizeFooterLayoutId(layoutId);
    const wasHidden = footerEl.classList.contains('hidden');
    footerEl.className = `footer-tpl-${tpl} footer-layout-${layout}${wasHidden ? ' hidden' : ''}`;
    document.body.classList.remove('footer-layout-auto', 'footer-layout-fixed', 'footer-layout-inline');
    document.body.classList.add(`body-footer-layout-${layout}`);
}

function estimateFooterBodyPadding(settings, templateId, layoutId) {
    if (normalizeFooterLayoutId(layoutId) === 'inline') return '60px';
    const hasCopyright = settings.showCopyright !== false;
    const hasLinks = !!settings.showFooter;
    const tpl = normalizeFooterTemplateId(templateId);

    if (!hasLinks && !hasCopyright) return '75px';

    if (tpl === 'stacked') {
        if (hasLinks && hasCopyright) return '175px';
        return hasLinks ? '155px' : '95px';
    }
    if (tpl === 'grid') {
        if (hasLinks && hasCopyright) return '145px';
        return hasLinks ? '125px' : '95px';
    }
    if (tpl === 'luxury') {
        if (hasLinks && hasCopyright) return '130px';
        return hasLinks ? '110px' : '95px';
    }
    if (hasLinks && hasCopyright) return '115px';
    return hasLinks || hasCopyright ? '95px' : '75px';
}

function renderAdminFooterTemplatePicker(selectedTemplate, selectedLayout) {
    const tplGrid = document.getElementById('admin-footer-template-grid');
    const layoutGrid = document.getElementById('admin-footer-layout-grid');
    const preview = document.getElementById('admin-footer-template-preview');

    const tpl = normalizeFooterTemplateId(selectedTemplate);
    const layout = normalizeFooterLayoutId(selectedLayout);

    if (tplGrid) {
        tplGrid.innerHTML = Object.values(FOOTER_TEMPLATES).map(t => `
            <label class="footer-template-option${t.id === tpl ? ' selected' : ''}">
                <input type="radio" name="admin-footer-template" value="${t.id}" ${t.id === tpl ? 'checked' : ''}
                    onchange="previewAdminFooterTemplate()">
                <span class="footer-template-option__name">${t.name}${t.default ? ' <em>(Default)</em>' : ''}</span>
                <span class="footer-template-option__desc">${t.description}</span>
            </label>`).join('');
    }

    if (layoutGrid) {
        layoutGrid.innerHTML = Object.values(FOOTER_LAYOUTS).map(l => `
            <label class="footer-layout-option${l.id === layout ? ' selected' : ''}">
                <input type="radio" name="admin-footer-layout" value="${l.id}" ${l.id === layout ? 'checked' : ''}
                    onchange="previewAdminFooterTemplate()">
                <span class="footer-template-option__name">${l.name}</span>
                <span class="footer-template-option__desc">${l.description}</span>
            </label>`).join('');
    }

    if (preview) {
        const mockSettings = {
            showFooter: true,
            showCopyright: true,
            copyright: document.getElementById('admin-footer-copyright')?.value?.trim() || 'Swag Stree',
            contactPhone: document.getElementById('admin-footer-phone')?.value?.trim() || '8800467686'
        };
        const currentTpl = document.querySelector('input[name="admin-footer-template"]:checked')?.value || tpl;
        preview.innerHTML = `<div class="admin-footer-preview-shell footer-tpl-${normalizeFooterTemplateId(currentTpl)} footer-layout-${layout}">
            <footer class="admin-footer-preview-inner">${buildFooterLinksHtml(currentTpl, mockSettings)}
            <div class="admin-footer-preview-copy"><i class="fa fa-copyright"></i> ${mockSettings.copyright}</div></footer></div>`;
    }
}

window.previewAdminFooterTemplate = function() {
    document.querySelectorAll('.footer-template-option').forEach(el => {
        el.classList.toggle('selected', !!el.querySelector('input:checked'));
    });
    document.querySelectorAll('.footer-layout-option').forEach(el => {
        el.classList.toggle('selected', !!el.querySelector('input:checked'));
    });
    renderAdminFooterTemplatePicker(
        document.querySelector('input[name="admin-footer-template"]:checked')?.value,
        document.querySelector('input[name="admin-footer-layout"]:checked')?.value
    );
};

window.buildFooterLinksHtml = buildFooterLinksHtml;
window.applyFooterShellClasses = applyFooterShellClasses;
window.estimateFooterBodyPadding = estimateFooterBodyPadding;
window.normalizeFooterTemplateId = normalizeFooterTemplateId;
window.normalizeFooterLayoutId = normalizeFooterLayoutId;
window.renderAdminFooterTemplatePicker = renderAdminFooterTemplatePicker;
