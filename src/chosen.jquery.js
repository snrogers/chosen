/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const $ = jQuery;

$.fn.extend({
  chosen(options) {
    // Do no harm and return as soon as possible for unsupported browsers, namely IE6 and IE7
    // Continue on if running IE document type but in compatibility mode
    if (!AbstractChosen.browser_is_supported()) {
      return this;
    }
    return this.each(function(input_field) {
      const $this = $(this);
      const chosen = $this.data('chosen');
      if (options === 'destroy') {
        if (chosen instanceof Chosen) {
          chosen.destroy();
        }
        return;
      }
      if (!(chosen instanceof Chosen)) {
        $this.data('chosen', new Chosen(this, options));
      }
    });
  }
});

class Chosen extends AbstractChosen {
  setup() {
    this.form_field_jq = $(this.form_field);
    return (this.current_selectedIndex = this.form_field.selectedIndex);
  }

  set_up_html() {
    const container_classes = ['chosen-container'];
    container_classes.push(
      `chosen-container-${this.is_multiple ? 'multi' : 'single'}`
    );
    if (this.inherit_select_classes && this.form_field.className) {
      container_classes.push(this.form_field.className);
    }
    if (this.is_rtl) {
      container_classes.push('chosen-rtl');
    }

    const container_props = {
      class: container_classes.join(' '),
      title: this.form_field.title
    };

    if (this.form_field.id.length) {
      container_props.id =
        this.form_field.id.replace(/[^\w]/g, '_') + '_chosen';
    }

    this.container = $('<div />', container_props);

    // CSP without 'unsafe-inline' doesn't allow setting the style attribute directly
    this.container.width(this.container_width());

    if (this.is_multiple) {
      this.container.html(this.get_multi_html());
    } else {
      this.container.html(this.get_single_html());
    }

    this.form_field_jq.hide().after(this.container);
    this.dropdown = this.container.find('div.chosen-drop').first();

    this.search_field = this.container.find('input').first();
    this.search_results = this.container.find('ul.chosen-results').first();
    this.search_field_scale();

    this.search_no_results = this.container.find('li.no-results').first();

    if (this.is_multiple) {
      this.search_choices = this.container.find('ul.chosen-choices').first();
      this.search_container = this.container.find('li.search-field').first();
    } else {
      this.search_container = this.container.find('div.chosen-search').first();
      this.selected_item = this.container.find('.chosen-single').first();
    }

    this.results_build();
    this.set_tab_index();
    return this.set_label_behavior();
  }

  on_ready() {
    return this.form_field_jq.trigger('chosen:ready', { chosen: this });
  }

  register_observers() {
    this.container.on('touchstart.chosen', evt => {
      this.container_mousedown(evt);
    });
    this.container.on('touchend.chosen', evt => {
      this.container_mouseup(evt);
    });

    this.container.on('mousedown.chosen', evt => {
      this.container_mousedown(evt);
    });
    this.container.on('mouseup.chosen', evt => {
      this.container_mouseup(evt);
    });
    this.container.on('mouseenter.chosen', evt => {
      this.mouse_enter(evt);
    });
    this.container.on('mouseleave.chosen', evt => {
      this.mouse_leave(evt);
    });

    this.search_results.on('mouseup.chosen', evt => {
      this.search_results_mouseup(evt);
    });
    this.search_results.on('mouseover.chosen', evt => {
      this.search_results_mouseover(evt);
    });
    this.search_results.on('mouseout.chosen', evt => {
      this.search_results_mouseout(evt);
    });
    this.search_results.on('mousewheel.chosen DOMMouseScroll.chosen', evt => {
      this.search_results_mousewheel(evt);
    });

    this.search_results.on('touchstart.chosen', evt => {
      this.search_results_touchstart(evt);
    });
    this.search_results.on('touchmove.chosen', evt => {
      this.search_results_touchmove(evt);
    });
    this.search_results.on('touchend.chosen', evt => {
      this.search_results_touchend(evt);
    });

    this.form_field_jq.on('chosen:updated.chosen', evt => {
      this.results_update_field(evt);
    });
    this.form_field_jq.on('chosen:activate.chosen', evt => {
      this.activate_field(evt);
    });
    this.form_field_jq.on('chosen:open.chosen', evt => {
      this.container_mousedown(evt);
    });
    this.form_field_jq.on('chosen:close.chosen', evt => {
      this.close_field(evt);
    });

    this.search_field.on('blur.chosen', evt => {
      this.input_blur(evt);
    });
    this.search_field.on('keyup.chosen', evt => {
      this.keyup_checker(evt);
    });
    this.search_field.on('keydown.chosen', evt => {
      this.keydown_checker(evt);
    });
    this.search_field.on('focus.chosen', evt => {
      this.input_focus(evt);
    });
    this.search_field.on('cut.chosen', evt => {
      this.clipboard_event_checker(evt);
    });
    this.search_field.on('paste.chosen', evt => {
      this.clipboard_event_checker(evt);
    });

    if (this.is_multiple) {
      return this.search_choices.on('click.chosen', evt => {
        this.choices_click(evt);
      });
    } else {
      return this.container.on('click.chosen', function(evt) {
        evt.preventDefault();
      }); // gobble click of anchor
    }
  }

  destroy() {
    $(this.container[0].ownerDocument).off(
      'click.chosen',
      this.click_test_action
    );
    if (this.form_field_label.length > 0) {
      this.form_field_label.off('click.chosen');
    }

    if (this.search_field[0].tabIndex) {
      this.form_field_jq[0].tabIndex = this.search_field[0].tabIndex;
    }

    this.container.remove();
    this.form_field_jq.removeData('chosen');
    return this.form_field_jq.show();
  }

  search_field_disabled() {
    this.is_disabled =
      this.form_field.disabled ||
      this.form_field_jq.parents('fieldset').is(':disabled');

    this.container.toggleClass('chosen-disabled', this.is_disabled);
    this.search_field[0].disabled = this.is_disabled;

    if (!this.is_multiple) {
      this.selected_item.off('focus.chosen', this.activate_field);
    }

    if (this.is_disabled) {
      return this.close_field();
    } else if (!this.is_multiple) {
      return this.selected_item.on('focus.chosen', this.activate_field);
    }
  }

  container_mousedown(evt) {
    if (this.is_disabled) {
      return;
    }

    if (
      evt &&
      ['mousedown', 'touchstart'].includes(evt.type) &&
      !this.results_showing
    ) {
      evt.preventDefault();
    }

    if (!(evt != null && $(evt.target).hasClass('search-choice-close'))) {
      if (!this.active_field) {
        if (this.is_multiple) {
          this.search_field.val('');
        }
        $(this.container[0].ownerDocument).on(
          'click.chosen',
          this.click_test_action
        );
        this.results_show();
      } else if (
        !this.is_multiple &&
        evt &&
        ($(evt.target)[0] === this.selected_item[0] ||
          $(evt.target).parents('a.chosen-single').length)
      ) {
        evt.preventDefault();
        this.results_toggle();
      }

      return this.activate_field();
    }
  }

  container_mouseup(evt) {
    if (evt.target.nodeName === 'ABBR' && !this.is_disabled) {
      return this.results_reset(evt);
    }
  }

  search_results_mousewheel(evt) {
    let delta;
    if (evt.originalEvent) {
      delta =
        evt.originalEvent.deltaY ||
        -evt.originalEvent.wheelDelta ||
        evt.originalEvent.detail;
    }
    if (delta != null) {
      evt.preventDefault();
      if (evt.type === 'DOMMouseScroll') {
        delta = delta * 40;
      }
      return this.search_results.scrollTop(
        delta + this.search_results.scrollTop()
      );
    }
  }

  blur_test(evt) {
    if (
      !this.active_field &&
      this.container.hasClass('chosen-container-active')
    ) {
      return this.close_field();
    }
  }

  close_field() {
    $(this.container[0].ownerDocument).off(
      'click.chosen',
      this.click_test_action
    );

    this.active_field = false;
    this.results_hide();

    this.container.removeClass('chosen-container-active');
    this.clear_backstroke();

    this.show_search_field_default();
    this.search_field_scale();
    return this.search_field.blur();
  }

  activate_field() {
    if (this.is_disabled) {
      return;
    }

    this.container.addClass('chosen-container-active');
    this.active_field = true;

    this.search_field.val(this.search_field.val());
    return this.search_field.focus();
  }

  test_active_click(evt) {
    const active_container = $(evt.target).closest('.chosen-container');
    if (active_container.length && this.container[0] === active_container[0]) {
      return (this.active_field = true);
    } else {
      return this.close_field();
    }
  }

  results_build() {
    this.parsing = true;
    this.selected_option_count = null;

    this.results_data =
      this.suggestions || SelectParser.select_to_array(this.form_field);

    debugger;

    this.single_set_selected_text();
    if (this.disable_search) {
      this.search_field[0].readOnly = true;
      this.container.addClass('chosen-container-single-nosearch');
    } else {
      this.search_field[0].readOnly = false;
      this.container.removeClass('chosen-container-single-nosearch');
    }

    this.update_results_content(this.results_option_build({ first: true }));

    this.search_field_disabled();
    this.show_search_field_default();
    this.search_field_scale();

    return (this.parsing = false);
  }

  result_do_highlight(el) {
    if (el.length) {
      this.result_clear_highlight();

      this.result_highlight = el;
      this.result_highlight.addClass('highlighted');

      const maxHeight = parseInt(this.search_results.css('maxHeight'), 10);
      const visible_top = this.search_results.scrollTop();
      const visible_bottom = maxHeight + visible_top;

      const high_top =
        this.result_highlight.position().top + this.search_results.scrollTop();
      const high_bottom = high_top + this.result_highlight.outerHeight();

      if (high_bottom >= visible_bottom) {
        return this.search_results.scrollTop(
          high_bottom - maxHeight > 0 ? high_bottom - maxHeight : 0
        );
      } else if (high_top < visible_top) {
        return this.search_results.scrollTop(high_top);
      }
    }
  }

  result_clear_highlight() {
    if (this.result_highlight) {
      this.result_highlight.removeClass('highlighted');
    }
    return (this.result_highlight = null);
  }

  results_show() {
    if (this.is_multiple && this.max_selected_options <= this.choices_count()) {
      this.form_field_jq.trigger('chosen:maxselected', { chosen: this });
      return false;
    }

    this.container.addClass('chosen-with-drop');
    this.results_showing = true;

    this.search_field.focus();
    this.search_field.val(this.get_search_field_value());

    this.winnow_results();
    return this.form_field_jq.trigger('chosen:showing_dropdown', {
      chosen: this
    });
  }

  update_results_content(content) {
    return this.search_results.html(content);
  }

  results_hide() {
    if (this.results_showing) {
      this.result_clear_highlight();

      this.container.removeClass('chosen-with-drop');
      this.form_field_jq.trigger('chosen:hiding_dropdown', { chosen: this });
    }

    return (this.results_showing = false);
  }

  set_tab_index(el) {
    if (this.form_field.tabIndex) {
      const ti = this.form_field.tabIndex;
      this.form_field.tabIndex = -1;
      return (this.search_field[0].tabIndex = ti);
    }
  }

  set_label_behavior() {
    this.form_field_label = this.form_field_jq.parents('label'); // first check for a parent label
    if (!this.form_field_label.length && this.form_field.id.length) {
      this.form_field_label = $(`label[for='${this.form_field.id}']`); //next check for a for=#{id}
    }

    if (this.form_field_label.length > 0) {
      return this.form_field_label.on('click.chosen', this.label_click_handler);
    }
  }

  show_search_field_default() {
    if (this.is_multiple && this.choices_count() < 1 && !this.active_field) {
      this.search_field.val(this.default_text);
      return this.search_field.addClass('default');
    } else {
      this.search_field.val('');
      return this.search_field.removeClass('default');
    }
  }

  search_results_mouseup(evt) {
    const target = $(evt.target).hasClass('active-result')
      ? $(evt.target)
      : $(evt.target)
          .parents('.active-result')
          .first();
    if (target.length) {
      this.result_highlight = target;
      this.result_select(evt);
      return this.search_field.focus();
    }
  }

  search_results_mouseover(evt) {
    const target = $(evt.target).hasClass('active-result')
      ? $(evt.target)
      : $(evt.target)
          .parents('.active-result')
          .first();
    if (target) {
      return this.result_do_highlight(target);
    }
  }

  search_results_mouseout(evt) {
    if (
      $(evt.target).hasClass('active-result') ||
      $(evt.target)
        .parents('.active-result')
        .first()
    ) {
      return this.result_clear_highlight();
    }
  }

  choice_build(item) {
    const choice = $('<li />', { class: 'search-choice' }).html(
      `<span>${this.choice_label(item)}</span>`
    );

    if (item.disabled) {
      choice.addClass('search-choice-disabled');
    } else {
      const close_link = $('<a />', {
        class: 'search-choice-close',
        'data-option-array-index': item.array_index
      });
      close_link.on('click.chosen', evt => this.choice_destroy_link_click(evt));
      choice.append(close_link);
    }

    return this.search_container.before(choice);
  }

  choice_destroy_link_click(evt) {
    evt.preventDefault();
    evt.stopPropagation();
    if (!this.is_disabled) {
      return this.choice_destroy($(evt.target));
    }
  }

  choice_destroy(link) {
    if (this.result_deselect(link[0].getAttribute('data-option-array-index'))) {
      if (this.active_field) {
        this.search_field.focus();
      } else {
        this.show_search_field_default();
      }

      if (
        this.is_multiple &&
        this.choices_count() > 0 &&
        this.get_search_field_value().length < 1
      ) {
        this.results_hide();
      }

      link
        .parents('li')
        .first()
        .remove();

      return this.search_field_scale();
    }
  }

  results_reset() {
    this.reset_single_select_options();
    // this.form_field.options[0].selected = true;
    this.single_set_selected_text();
    this.show_search_field_default();
    this.results_reset_cleanup();
    this.trigger_form_field_change();
    if (this.active_field) {
      return this.results_hide();
    }
  }

  results_reset_cleanup() {
    this.current_selectedIndex = this.form_field.selectedIndex;
    return this.selected_item.find('abbr').remove();
  }

  result_select(evt) {
    if (this.result_highlight) {
      const high = this.result_highlight;
      debugger;

      this.result_clear_highlight();

      high.addClass('result-selected');

      const item = this.results_data[
        high[0].getAttribute('data-option-array-index')
      ];
      item.selected = true;

      if (!this.suggestions) {
        this.form_field.options[item.options_index].selected = true;
      }
      this.selected_option_count = null;

      if (this.is_multiple) {
        this.choice_build(item);
      } else {
        this.single_set_selected_text(this.choice_label(item));
      }

      if (
        this.is_multiple &&
        (!this.hide_results_on_select || (evt.metaKey || evt.ctrlKey))
      ) {
        if (evt.metaKey || evt.ctrlKey) {
          this.winnow_results({ skip_highlight: true });
        } else {
          this.search_field.val('');
          this.winnow_results();
        }
      } else {
        this.results_hide();
        this.show_search_field_default();
      }

      if (
        this.is_multiple ||
        this.form_field.selectedIndex !== this.current_selectedIndex
      ) {
        if (!this.options.suggestions) {
          this.trigger_form_field_change({
            selected: this.form_field.options[item.options_index].value
          });
        }
      }
      this.current_selectedIndex = this.form_field.selectedIndex;

      evt.preventDefault();

      return this.search_field_scale();
    }
  }

  single_set_selected_text(text) {
    if (text == null) {
      text = this.default_text;
    }
    if (text === this.default_text) {
      this.selected_item.addClass('chosen-default');
    } else {
      this.single_deselect_control_build();
      this.selected_item.removeClass('chosen-default');
    }

    return this.selected_item.find('span').html(text);
  }

  result_deselect(pos) {
    const result_data = this.results_data[pos];

    if (!this.form_field.options[result_data.options_index].disabled) {
      result_data.selected = false;

      this.form_field.options[result_data.options_index].selected = false;
      this.selected_option_count = null;

      this.result_clear_highlight();
      if (this.results_showing) {
        this.winnow_results();
      }

      this.trigger_form_field_change({
        deselected: this.form_field.options[result_data.options_index].value
      });
      this.search_field_scale();

      return true;
    } else {
      return false;
    }
  }

  single_deselect_control_build() {
    if (!this.allow_single_deselect) {
      return;
    }
    if (!this.selected_item.find('abbr').length) {
      this.selected_item
        .find('span')
        .first()
        .after('<abbr class="search-choice-close"></abbr>');
    }
    return this.selected_item.addClass('chosen-single-with-deselect');
  }

  get_search_field_value() {
    return this.search_field.val();
  }

  get_search_text() {
    return $.trim(this.get_search_field_value());
  }

  escape_html(text) {
    return $('<div/>')
      .text(text)
      .html();
  }

  winnow_results_set_highlight() {
    const selected_results = !this.is_multiple
      ? this.search_results.find('.result-selected.active-result')
      : [];
    const do_high = selected_results.length
      ? selected_results.first()
      : this.search_results.find('.active-result').first();

    if (do_high != null) {
      return this.result_do_highlight(do_high);
    }
  }

  no_results(terms) {
    const no_results_html = this.get_no_results_html(terms);
    this.search_results.append(no_results_html);
    return this.form_field_jq.trigger('chosen:no_results', { chosen: this });
  }

  no_results_clear() {
    return this.search_results.find('.no-results').remove();
  }

  keydown_arrow() {
    if (this.results_showing && this.result_highlight) {
      const next_sib = this.result_highlight
        .nextAll('li.active-result')
        .first();
      if (next_sib) {
        return this.result_do_highlight(next_sib);
      }
    } else {
      return this.results_show();
    }
  }

  keyup_arrow() {
    if (!this.results_showing && !this.is_multiple) {
      return this.results_show();
    } else if (this.result_highlight) {
      const prev_sibs = this.result_highlight.prevAll('li.active-result');

      if (prev_sibs.length) {
        return this.result_do_highlight(prev_sibs.first());
      } else {
        if (this.choices_count() > 0) {
          this.results_hide();
        }
        return this.result_clear_highlight();
      }
    }
  }

  keydown_backstroke() {
    if (this.pending_backstroke) {
      this.choice_destroy(this.pending_backstroke.find('a').first());
      return this.clear_backstroke();
    } else {
      const next_available_destroy = this.search_container
        .siblings('li.search-choice')
        .last();
      if (
        next_available_destroy.length &&
        !next_available_destroy.hasClass('search-choice-disabled')
      ) {
        this.pending_backstroke = next_available_destroy;
        if (this.single_backstroke_delete) {
          return this.keydown_backstroke();
        } else {
          return this.pending_backstroke.addClass('search-choice-focus');
        }
      }
    }
  }

  clear_backstroke() {
    if (this.pending_backstroke) {
      this.pending_backstroke.removeClass('search-choice-focus');
    }
    return (this.pending_backstroke = null);
  }

  search_field_scale() {
    if (!this.is_multiple) {
      return;
    }

    const style_block = {
      position: 'absolute',
      left: '-1000px',
      top: '-1000px',
      display: 'none',
      whiteSpace: 'pre'
    };

    const styles = [
      'fontSize',
      'fontStyle',
      'fontWeight',
      'fontFamily',
      'lineHeight',
      'textTransform',
      'letterSpacing'
    ];

    for (let style of Array.from(styles)) {
      style_block[style] = this.search_field.css(style);
    }

    const div = $('<div />').css(style_block);
    div.text(this.get_search_field_value());
    $('body').append(div);

    let width = div.width() + 25;
    div.remove();

    if (this.container.is(':visible')) {
      width = Math.min(this.container.outerWidth() - 10, width);
    }

    return this.search_field.width(width);
  }

  trigger_form_field_change(extra) {
    this.form_field_jq.trigger('input', extra);
    return this.form_field_jq.trigger('change', extra);
  }
}
