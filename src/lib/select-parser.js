/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
class SelectParser {
  constructor() {
    this.options_index = 0;
    this.parsed = [];
  }

  add_node(child) {
    if (child.nodeName.toUpperCase() === 'OPTGROUP') {
      return this.add_group(child);
    } else {
      return this.add_option(child);
    }
  }

  add_group(group) {
    const group_position = this.parsed.length;
    this.parsed.push({
      array_index: group_position,
      group: true,
      label: group.label,
      title: group.title ? group.title : undefined,
      children: 0,
      disabled: group.disabled,
      classes: group.className
    });
    return Array.from(group.childNodes).map(option =>
      this.add_option(option, group_position, group.disabled)
    );
  }

  add_option(option, group_position, group_disabled) {
    if (option.nodeName.toUpperCase() === 'OPTION') {
      if (option.text !== '') {
        if (group_position != null) {
          this.parsed[group_position].children += 1;
        }
        this.parsed.push({
          array_index: this.parsed.length,
          options_index: this.options_index,
          value: option.value,
          text: option.text,
          html: option.innerHTML,
          title: option.title ? option.title : undefined,
          selected: option.selected,
          disabled: group_disabled === true ? group_disabled : option.disabled,
          group_array_index: group_position,
          group_label:
            group_position != null ? this.parsed[group_position].label : null,
          classes: option.className,
          style: option.style.cssText
        });
      } else {
        this.parsed.push({
          array_index: this.parsed.length,
          options_index: this.options_index,
          empty: true
        });
      }
      return (this.options_index += 1);
    }
  }
}

SelectParser.select_to_array = function(select) {
  const parser = new SelectParser();
  for (let child of Array.from(select.childNodes)) {
    parser.add_node(child);
  }
  return parser.parsed;
};
