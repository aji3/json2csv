const SuperFlatten = (function() {
  SuperFlattenContext: {
    function SuperFlattenContext() {
      this.names = [];
      this.values = [];
      this.types = [];
      this.root = [];
    }
    const p = SuperFlattenContext.prototype;
    p.getCurrentName = function(key) {
      let ret = "";
      this.names.forEach(name => {
        if (name !== '{}') {
          if (ret.length > 0) {
            ret += '.';
          }
          ret += name;
        }
      });
      if (key && key.length > 0) {
        if (ret.length > 0) {
          ret = `${ret}.${key}`;
        } else {
          ret = key;
        }
      }
      return ret;
    }
    p.getCurrentValues = function() {
      if (this.values.length === 0) {
        return this.root;
      } else {
        return this.values[this.values.length - 1];
      }
    }
    p.getCurrentType = function() {
      if (this.types.length === 0) {
        return 'list';
      } else {
        return this.types[this.types.length - 1];
      }
    }
    p.startObject = function(objectName) {
      this.values.push([]);
      this.names.push(objectName);
      this.types.push('object');
    }
    p.startList = function(listName) {
      this.values.push([]);
      this.names.push(listName === '[]' ? listName : listName + '[]');
      this.types.push('list');
    }
    p.addValue = function(key, value) {
      let obj = {};
      let name = this.getCurrentName(key);
      obj[name] = value;
      this.getCurrentValues().push(obj);
    }
    p.endList = function() {
      const list = this.values.pop();
      this.applyResult(list);
    }
    p.endObject = function() {
      const list = this.values.pop();
      let resultList = [];
      for (var i = 0; i < list.length; i++) {
        let obj = list[i];
        const layerResultList = [];
        if (Array.isArray(obj)) {
          for (var j = 0; j < obj.length; j++) {
            const value = obj[j];
            if (resultList.length > 0) {
              for (var k = 0; k < resultList.length; k++) {
                let resultObj = resultList[k];
                const tmp = Object.assign({}, value, resultObj);
                layerResultList.push(tmp);
              }
            } else {
              layerResultList.push(Object.assign({}, value));
            }
          }
        } else if (typeof obj === 'object') {
          if (resultList.length > 0) {
            for (var k = 0; k < resultList.length; k++) {
              let resultObj = resultList[k];
              const tmp = Object.assign({}, resultObj, obj);
              layerResultList.push(tmp);
            }
          } else {
            layerResultList.push(Object.assign({}, obj));
          }
        } else {
          throw "error";
        }
        if (layerResultList.length > 0) {
          resultList = layerResultList;
        }
      }
      this.applyResult(resultList);
    }
    p.applyResult = function(list) {
      this.types.pop();
      this.names.pop();
      const type = this.getCurrentType();
      const resultList = this.getCurrentValues();
      // if (!type) {
      //   // !type is when context shows the root of this object.
      //   Array.prototype.push.apply(this.root, list);
      // } else
      if (type === 'list') {
        Array.prototype.push.apply(resultList, list);
      } else if (type === 'object') {
        resultList.push(list);
      } else {
        // no operation
      }
    }
  }

  const superflattenList = function(list, context) {
    for (var i = 0; i < list.length; i++) {
      const obj = list[i];
      if (Array.isArray(obj)) {
        context.startList('[]');
        superflattenList(obj, context);
        context.endList();
      } else if (typeof obj === 'object') {
        context.startObject('{}');
        superflattenObject(obj, context);
        context.endObject();
      } else {
        context.addValue(null, obj);
      }
    }
  }

  const superflattenObject = function(obj, context) {
    for (const key in obj) {
      const value = obj[key];
      if (Array.isArray(value)) {
        context.startList(key);
        superflattenList(value, context);
        context.endList();
      } else if (typeof value === 'object') {
        context.startObject(key);
        superflattenObject(value, context);
        context.endObject();
      } else {
        context.addValue(key, value);
      }
    }
  }

  const superflatten = function(obj, schema) {
    const context = new SuperFlattenContext();
    if (Array.isArray(obj)) {
      superflattenList(obj, context);
    } else if (typeof obj === 'object') {
      superflattenObject(obj, context);
    } else {
      context.root = [obj];
    }
    return context.root;
  }

  SuperFlattenCreateSchemaContext: {
    function SuperFlattenCreateSchemaContext() {
      SuperFlattenContext.call(this);
    }
    Object.setPrototypeOf(SuperFlattenCreateSchemaContext.prototype, SuperFlattenContext.prototype);
    const p = SuperFlattenCreateSchemaContext.prototype;
    p.endObject = function() {
      const list = this.values.pop();
      this.applyResult(list);
    }
    p.endList = function() {
      const list = this.values.pop();
      this.applyResult(list);
    }
    p.addValue = function(key, value) {
      const k = this.getCurrentName(key);
      this.getCurrentValues().push(k);
    }
    p.applyResult = function(list) {
      this.types.pop();
      this.names.pop();
      const type = this.getCurrentType();
      const resultList = this.getCurrentValues();
      if (!type) {
        // !type is when context shows the root of this object.
        this.root = list;
      } else {
        list.forEach(elem => {
          if (!resultList.includes(elem)) {
            resultList.push(elem);
          }
        })
      }
    }
  }

  const Type = {
    object: 'object',
    list: 'list',
    value: 'value',
  }
  const SuperFlattenStatus = {
    object: {
      on: 'ON',
      asList: 'AS_LIST',
      off: 'OFF'
    },
    list: {
      on: 'ON',
      asObject: 'AS_OBJECT',
      off: 'OFF'
    },
    value: {
      on: 'ON',
      off: 'OFF'
    }
  }
  const Schema = function(type, name) {
    this.type = type;
    this.name = name;
    this.parent = null;
    this.children = {};
    this.listSize = 0;

    switch (type) {
      case 'object':
        this.status = SuperFlattenStatus.object.on;
        break;
      case 'list':
        this.status = SuperFlattenStatus.list.on;
        break;
      case 'value':
        this.status = SuperFlattenStatus.value.on;
        break;
      default:
        break;
    }
  }
  const schemaProto = Schema.prototype;
  schemaProto.getParent = function() {
    return this.parent;
  }
  schemaProto.setParent = function(parent) {
    this.parent = parent;
  }
  schemaProto.getChild = function(name) {
    return this.children[name];
  }
  schemaProto.addChild = function(schema) {
    if (!this.children[schema.getName()]) {
      this.children[schema.getName()] = schema;
      schema.setParent(this);
    }
    return this.children[schema.getName()];
  }
  schemaProto.getName = function() {
    return this.name;
  }
  schemaProto.addListSize = function(listSize) {
    this.listSize += listSize;
  }


  const createSchema = function(obj) {
    const context = new SuperFlattenCreateSchemaContext();
    if (Array.isArray(obj)) {
      superflattenList(obj, context);
    } else if (typeof obj === 'object') {
      superflattenObject(obj, context);
    } else {
      context.root.push(obj);
    }

    let rootType = Type.object;
    if (Array.isArray(obj)) {
      rootType = Type.list;
    } else if (typeof obj === 'object'){
      rootType = Type.object;
    } else {
      rootType = Type.value;
    }
    const rootSchema = new Schema(rootType, '#root');
    context.root.forEach(elem => {
      let parentSchema = rootSchema;
      const names = elem.split('.');
      for (let i = 0; i < names.length; i++) {
        let name = names[i];
        let type = null;
        if (name.endsWith('[]')) {
          type = Type.list;
          if (name.length > 2) {
            name = name.replace('[]', '');
          }
        } else if (i !== names.length - 1) {
          type = Type.object;
        } else {
          type = Type.value;
        }
        const schema = new Schema(type, name);
        parentSchema = parentSchema.addChild(schema);
      }
    });
    return rootSchema;
  }

  const countSize = function(obj, schema) {
    let count = 0;
    if (Array.isArray(obj)) {
      count = countListSize(obj, schema);
    } else {
      count = countObjectSize(obj, schema);
    }
    return count;
  }
  const countListSize = function(list, schema) {
    if (schema.status === SuperFlattenStatus.list.off) {
      return 0;
    } else if (schema.status === SuperFlattenStatus.list.asObject) {
      if (list.length > 0) {
        return 1;
      } else {
        return 0;
      }
    }
    var count = 0;
    for (var i = 0; i < list.length; i++) {
      var obj = list[i];
      if (Array.isArray(obj)) {
        var childSchema = schema.getChild('[]');
        count += countListSize(obj, childSchema);
      } else if (typeof obj === 'object') {
        count += countObjectSize(obj, schema);
      } else {
        if (schema.status === SuperFlattenStatus.list.on) {
          count++;
        }
      }
    }
    return count;
  }
  function countObjectSize(object, schema) {
    if (schema.status === SuperFlattenStatus.object.off) {
      return 1;
    }
    var count = 1;
    for (var key in object) {
      var obj = object[key];
      var childSchema = schema.children[key];
      var tmp = 0;
      if (Array.isArray(obj)) {
        tmp = countListSize(obj, childSchema);
      } else if (typeof obj === 'object') {
        tmp = countObjectSize(obj, childSchema);
      } else {
      }
      if (tmp != 0) {
        if (schema.status === SuperFlattenStatus.object.on) {
          count *= tmp;
        } else if (schema.status === SuperFlattenStatus.object.asList){
          count += tmp;
        } else if (schema.status === SuperFlattenStatus.object.off){
          // OFF - no operation
        } else {
          count *= tmp;
        }
      }
    }
    return count;
  }

  return {superflatten, createSchema, countSize};
}());
