// Footer template registry — extensible for future theme templates
window.FOOTER_TEMPLATES = {
    classic: {
        id: 'classic',
        name: 'Classic Chips',
        description: 'Gold pill links in a row — the original Swag Stree footer.',
        default: true,
        group: 'Swag Stree'
    },
    minimal: {
        id: 'minimal',
        name: 'Minimal Strip',
        description: 'Compact text links with dot separators.',
        group: 'Compact'
    },
    underline: {
        id: 'underline',
        name: 'Text Links',
        description: 'Pipe-separated text links — classic e-commerce footer style.',
        group: 'Compact'
    },
    capsule: {
        id: 'capsule',
        name: 'Capsule Bar',
        description: 'One unified bar with gold dividers — quick-commerce app style.',
        group: 'App Style'
    },
    dock: {
        id: 'dock',
        name: 'Floating Dock',
        description: 'Raised dock with three equal slots — modern app navigation.',
        group: 'App Style'
    },
    iconbar: {
        id: 'iconbar',
        name: 'Icon Bar',
        description: 'Large gold icons with labels — mobile app footer style.',
        group: 'App Style'
    },
    stacked: {
        id: 'stacked',
        name: 'Stacked Cards',
        description: 'Full-width list rows — best readability on small phones.',
        group: 'Readable'
    },
    split: {
        id: 'split',
        name: 'Split Help',
        description: 'Info links plus a highlighted call strip — support-first layout.',
        group: 'Readable'
    },
    grid: {
        id: 'grid',
        name: 'Grid Actions',
        description: 'Three equal tap tiles — thumb-friendly grid.',
        group: 'Readable'
    },
    luxury: {
        id: 'luxury',
        name: 'Luxury Bar',
        description: 'Premium gold brand strip with spaced icon links.',
        group: 'Swag Stree'
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
        { type: 'privacy', icon: 'fa-shield-halved', label: 'Privacy Policy', onclick: "openFooterPage('privacy')" }
    ];
}

function renderFooterLinkItem(item, className, innerHtml) {
    const idAttr = item.type === 'call' ? ' id="footer-contact-link"' : '';
    if (item.href) {
        return `<a${idAttr} href="${item.href}" class="${className}">${innerHtml}</a>`;
    }
    return `<button type="button" class="${className}" onclick="${item.onclick}">${innerHtml}</button>`;
}

function buildFooterLinksHtml(templateId, settings) {
    const tpl = normalizeFooterTemplateId(templateId);
    const items = getFooterLinkItems(settings);

    if (tpl === 'stacked') {
        return `<div class="footer-links-stacked">${items.map(item =>
            renderFooterLinkItem(item, 'footer-stacked-link',
                `<i class="fa ${item.icon}"></i><span>${item.label}</span><i class="fa fa-chevron-right footer-stacked-chevron"></i>`)
        ).join('')}</div>`;
    }

    if (tpl === 'grid') {
        return `<div class="footer-links-grid">${items.map(item =>
            renderFooterLinkItem(item, 'footer-grid-link',
                `<i class="fa ${item.icon}"></i><span>${item.label}</span>`)
        ).join('')}</div>`;
    }

    if (tpl === 'minimal') {
        return `<div class="footer-links-minimal">${items.map((item, idx) => {
            const sep = idx > 0 ? '<span class="footer-minimal-sep">·</span>' : '';
            return sep + renderFooterLinkItem(item, 'footer-minimal-link',
                `<i class="fa ${item.icon}"></i> ${item.label}`);
        }).join('')}</div>`;
    }

    if (tpl === 'underline') {
        return `<div class="footer-links-underline">${items.map((item, idx) => {
            const sep = idx > 0 ? '<span class="footer-underline-sep">|</span>' : '';
            return sep + renderFooterLinkItem(item, 'footer-underline-link', item.label);
        }).join('')}</div>`;
    }

    if (tpl === 'capsule') {
        return `<div class="footer-links-capsule">${items.map((item, idx) => {
            const divider = idx > 0 ? '<span class="footer-capsule-divider"></span>' : '';
            return divider + renderFooterLinkItem(item, 'footer-capsule-segment',
                `<i class="fa ${item.icon}"></i><span>${item.label}</span>`);
        }).join('')}</div>`;
    }

    if (tpl === 'dock') {
        return `<div class="footer-links-dock">${items.map(item =>
            renderFooterLinkItem(item, 'footer-dock-slot',
                `<i class="fa ${item.icon}"></i><span>${item.label}</span>`)
        ).join('')}</div>`;
    }

    if (tpl === 'iconbar') {
        return `<div class="footer-links-iconbar">${items.map(item =>
            renderFooterLinkItem(item, 'footer-iconbar-item',
                `<span class="footer-iconbar-icon"><i class="fa ${item.icon}"></i></span><span class="footer-iconbar-label">${item.label}</span>`)
        ).join('')}</div>`;
    }

    if (tpl === 'split') {
        const infoItems = items.filter(i => i.type !== 'call');
        const callItem = items.find(i => i.type === 'call');
        return `<div class="footer-links-split">
            <div class="footer-split-info">${infoItems.map(item =>
                renderFooterLinkItem(item, 'footer-split-link',
                    `<i class="fa ${item.icon}"></i><span>${item.label}</span>`)
            ).join('')}</div>
            ${callItem ? renderFooterLinkItem(callItem, 'footer-split-call',
                `<i class="fa ${callItem.icon}"></i><span>${callItem.label}</span><i class="fa fa-arrow-right footer-split-call-arrow"></i>`) : ''}
        </div>`;
    }

    if (tpl === 'luxury') {
        return `<div class="footer-luxury-brand"><span class="footer-luxury-mark"></span><span id="footer-luxury-brand-text">${settings?.copyright || 'Swag Stree'}</span></div>
            <div class="footer-links-luxury">${items.map(item =>
                renderFooterLinkItem(item, 'footer-luxury-link',
                    `<i class="fa ${item.icon}"></i><span>${item.label}</span>`)
            ).join('')}</div>`;
    }

    // classic (default)
    return `<div id="footer-links-row" class="footer-links-classic">${items.map(item =>
        renderFooterLinkItem(item, 'footer-chip', `<i class="fa ${item.icon}"></i> ${item.label}`)
    ).join('')}</div>`;
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

    const tallTemplates = { stacked: [175, 155], split: [165, 145], grid: [145, 125], dock: [140, 120], iconbar: [135, 115] };
    if (tallTemplates[tpl]) {
        const [both, linksOnly] = tallTemplates[tpl];
        if (hasLinks && hasCopyright) return `${both}px`;
        return hasLinks ? `${linksOnly}px` : '95px';
    }
    if (tpl === 'luxury') {
        if (hasLinks && hasCopyright) return '130px';
        return hasLinks ? '110px' : '95px';
    }
    if (tpl === 'capsule') {
        if (hasLinks && hasCopyright) return '120px';
        return hasLinks ? '100px' : '95px';
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
        const groups = {};
        Object.values(FOOTER_TEMPLATES).forEach(t => {
            const g = t.group || 'Other';
            if (!groups[g]) groups[g] = [];
            groups[g].push(t);
        });
        tplGrid.innerHTML = Object.entries(groups).map(([groupName, templates]) => `
            <div class="footer-template-group">
                <span class="footer-template-group__label">${groupName}</span>
                ${templates.map(t => `
                    <label class="footer-template-option${t.id === tpl ? ' selected' : ''}">
                        <input type="radio" name="admin-footer-template" value="${t.id}" ${t.id === tpl ? 'checked' : ''}
                            onchange="previewAdminFooterTemplate()">
                        <span class="footer-template-option__name">${t.name}${t.default ? ' <em>(Default)</em>' : ''}</span>
                        <span class="footer-template-option__desc">${t.description}</span>
                    </label>`).join('')}
            </div>`).join('');
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
