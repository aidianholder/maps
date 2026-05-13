/**
 * A MapLibre GL IControl that replicates the @watergis/mapbox-gl-style-switcher
 * UI, with two bugs fixed:
 *  1. stopPropagation() on the open-click so the document listener doesn't
 *     immediately close the dropdown on the same event bubble.
 *  2. event.target instead of the deprecated event.srcElement.
 */
export class StyleSwitcherControl {
  constructor(styles = [], defaultStyle = '') {
    this._styles = styles;
    this._default = defaultStyle;
  }

  onAdd(map) {
    this._map = map;

    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group style-switcher-ctrl';

    // Icon button
    this._btn = document.createElement('button');
    this._btn.type = 'button';
    this._btn.className = 'style-switcher-btn';
    this._btn.title = 'Switch map style';
    this._btn.setAttribute('aria-label', 'Switch map style');
    this._btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = this._list.style.display === 'block';
      this._list.style.display = open ? 'none' : 'block';
    });

    // Dropdown list
    this._list = document.createElement('div');
    this._list.className = 'style-switcher-list';

    for (const style of this._styles) {
      const item = document.createElement('button');
      item.type = 'button';
      item.textContent = style.title;
      if (style.title === this._default) item.classList.add('active');

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.classList.contains('active')) {
          this._list.style.display = 'none';
          return;
        }
        map.setStyle(style.uri);
        map.getContainer().dispatchEvent(
          new CustomEvent('mapstylechange', { detail: { uri: style.uri } })
        );
        this._list.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        item.classList.add('active');
        this._list.style.display = 'none';
      });

      this._list.appendChild(item);
    }

    this._container.appendChild(this._btn);
    this._container.appendChild(this._list);

    this._closeOnOutsideClick = (e) => {
      if (!this._container.contains(e.target)) {
        this._list.style.display = 'none';
      }
    };
    document.addEventListener('click', this._closeOnOutsideClick);

    return this._container;
  }

  onRemove() {
    document.removeEventListener('click', this._closeOnOutsideClick);
    this._container.parentNode?.removeChild(this._container);
    this._map = undefined;
  }

  getDefaultPosition() {
    return 'bottom-left';
  }
}
