// --- public/siteBlueprintMapper.js ---
// Scans ALL Velo elements (including default Wix IDs like #box1, #text2) + pairs with raw browser DOM/CSS

import wixLocationFrontend from 'wix-location-frontend';
import wixWindowFrontend from 'wix-window-frontend';
import { session } from 'wix-storage-frontend';
import { saveBlueprintToCms } from 'backend/geminiAssistant.web';

const VELO_COMPONENT_TYPES = [
  'Page', 'HeaderContainer', 'FooterContainer', 'Section', 'Box', 'ColumnStrip', 'Column',
  'MultiStateBox', 'State', 'Repeater', 'Container', 'Text', 'Button', 'TextInput',
  'TextBox', 'Dropdown', 'Checkbox', 'RadioButtonGroup', 'Switch', 'Slider',
  'Image', 'VectorImage', 'Gallery', 'HtmlComponent', 'CustomElement', 'Menu'
];

function safeStyle($el) {
  try {
    if (!$el || !$el.style) return undefined;
    const s = $el.style;
    return {
      backgroundColor: s.backgroundColor || undefined,
      borderColor: s.borderColor || undefined,
      borderWidth: s.borderWidth || undefined,
      borderRadius: s.borderRadius || undefined,
      color: s.color || undefined,
      foregroundColor: s.foregroundColor || undefined
    };
  } catch (e) {
    return undefined;
  }
}

export async function captureFullPageBlueprint($w) {
  const pageSlug = wixLocationFrontend.path.length > 0 ? '/' + wixLocationFrontend.path.join('/') : '/home';
  const formFactor = wixWindowFrontend.formFactor;

  // Deduplicate per page and formFactor using wix-storage session
  const dedupKey = `blueprint_captured_${pageSlug}_${formFactor}`;
  const alreadyCaptured = session.getItem(dedupKey);
  const bypassDedup = wixLocationFrontend.query.ebot === 'Cashew09po' || wixLocationFrontend.query.spider === '1';
  
  let blueprint = null;

  try {
    if (!alreadyCaptured || bypassDedup) {
      session.setItem(dedupKey, 'true');

      const viewport = await wixWindowFrontend.getBoundingRect().catch(() => null);
      const elementsMap = {};

      // 1. Discover every Velo element on the page, including default #box1, #text2, etc.
      for (const typeName of VELO_COMPONENT_TYPES) {
        try {
          const matched = $w(typeName);
          const list = Array.isArray(matched) ? matched : (matched && matched.id ? [matched] : []);
          for (const el of list) {
            if (!el || !el.id || elementsMap[el.id]) continue;
            const parentId = el.parent && el.parent.id ? `#${el.parent.id}` : null;
            const childIds = Array.isArray(el.children) ? el.children.map(c => `#${c.id}`) : undefined;
            
            // Record all MultiStateBox states and child IDs
            const states = Array.isArray(el.states) ? el.states.map(st => ({
              id: st.id,
              childIds: Array.isArray(st.children) ? st.children.map(c => `#${c.id}`) : []
            })) : undefined;
            
            const currentState = el.currentState && el.currentState.id ? el.currentState.id : undefined;

            elementsMap[`#${el.id}`] = {
              id: `#${el.id}`,
              type: el.type || typeName,
              parentId,
              childIds,
              hidden: Boolean(el.hidden),
              collapsed: Boolean(el.collapsed),
              rendered: Boolean(el.rendered),
              text: typeof el.text === 'string' ? el.text.slice(0, 120) : undefined,
              label: typeof el.label === 'string' ? el.label : undefined,
              placeholder: typeof el.placeholder === 'string' ? el.placeholder : undefined,
              src: typeof el.src === 'string' ? el.src : undefined,
              states,
              currentState,
              style: safeStyle(el)
            };
          }
        } catch (e) {}
      }

      blueprint = {
        capturedAt: new Date().toISOString(),
        url: wixLocationFrontend.url,
        path: wixLocationFrontend.path,
        formFactor,
        viewport,
        totalElementsCount: Object.keys(elementsMap).length,
        elements: elementsMap
      };

      await saveBlueprintToCms(`FullBlueprint: ${pageSlug} (${formFactor})`, {
        category: 'migration_blueprint',
        domCssBlueprint: blueprint
      });

      // Call window.exportPageToSupabaseBlueprint if available
      if (typeof window !== 'undefined' && typeof window.exportPageToSupabaseBlueprint === 'function') {
        try {
          window.exportPageToSupabaseBlueprint(blueprint);
        } catch (err) {
          console.error('Error calling window.exportPageToSupabaseBlueprint:', err);
        }
      }
    } else {
      console.log('Blueprint already captured for this session, page, and formFactor.');
    }
  } finally {
    // Auto-Spider support
    if (wixLocationFrontend.query.spider === '1' && wixLocationFrontend.query.ebot === 'Cashew09po') {
      const spiderKey = 'auto_spider_routes';
      let routesData = session.getItem(spiderKey);
      let routes;
      
      if (!routesData) {
        routes = [
          { route: '/', visited: false },
          { route: '/packages', visited: false },
          { route: '/booking-hq', visited: false },
          { route: '/detailer', visited: false },
          { route: '/checkout', visited: false }
        ];
      } else {
        routes = JSON.parse(routesData);
      }

      const currentRoute = wixLocationFrontend.path.length > 0 ? '/' + wixLocationFrontend.path.join('/') : '/';
      
      routes.forEach(r => {
        if (r.route === currentRoute) {
          r.visited = true;
        }
      });

      session.setItem(spiderKey, JSON.stringify(routes));

      const nextUnvisited = routes.find(r => !r.visited);
      if (nextUnvisited) {
        setTimeout(() => {
          wixLocationFrontend.to(`${nextUnvisited.route}?ebot=Cashew09po&spider=1`);
        }, 1500);
      }
    }
  }

  return blueprint;
}
