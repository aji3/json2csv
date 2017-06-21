var SuperFlatten = SuperFlatten || (function() {
  "use strict"
  SuperFlattenContext: {
    var SuperFlattenContext = function() {
      this.names = [];
      this.values = [];
      this.types = [];
      this.root = [];
      this.schemaMap = null;
    }
    const p = SuperFlattenContext.prototype;
    p.setSchema = function(schema) {
      const schemaMap = {};
      const schemaConverter = function(schema) {
        schemaMap[schema.getContextName()] = schema;
        for (const key in schema.children) {
          const child = schema.children[key];
          schemaConverter(child);
        }
      };
      schemaConverter(schema);
      console.log(schemaMap);
      this.schemaMap = schemaMap;
    }
    p.getStatus = function(key) {
      // console.log(this.getCurrentName());
      if (!this.schemaMap) {
        return 'ON';
      }
      return this.schemaMap[this.getCurrentName(key)] ? this.schemaMap[this.getCurrentName(key)].status : 'ON';
    }
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
    p.setCurrentType = function(type) {
      this.types[this.types.length - 1] = type;
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
      // this.names.push(listName === '[]' ? listName : listName + '[]');
      this.names.push(listName);
      this.types.push('list');
    }
    p.addValue = function(key, value) {
      let obj = {};
      let name = this.getCurrentName(key);
      obj[name] = value;
      this.getCurrentValues().push(obj);
    }
    p.endList = function(forcedToBeList) {
      const list = this.values.pop();
      if (forcedToBeList) {
        const tmpList = [];
        list.forEach((elem) => {
          if (Array.isArray(elem)) {
            Array.prototype.push.apply(tmpList, elem)
          } else {
            tmpList.push(elem);
          }
        })
        const currentName = this.getCurrentName();
        for (let i = 0; i < tmpList.length; i++) {
          const elem = tmpList[i];
          const newObj = {};
          for (const key in elem) {
            const reg = `${currentName}\\.([^\\.]+)\\.?`;
            const result = key.match(reg);
            if (result) {
              const id = result[1];
              const newKey = key.replace(`${currentName}.${id}`, `${currentName}.[]`);
              newObj[newKey] = elem[key];
              newObj[`${currentName}.[]._sfid`] = id;
            }
          }
          list[i] = newObj;
        };
      }
      this.applyResult(list);
    }
    p.endObject = function(forcedToBeObject) {
      const list = this.values.pop();
      if (forcedToBeObject) {
        // The object is forcedToBeObject means that it is originally a list but the superflatten result should be converted to object.
        // The object which is originally came from a list has items with name of xxx[].aaa, xxx[].bbb, etc.
        // To force it to be object, this name should be converted to xxx.0.aaa, xxx.0.bbb, xxx.1.aaa, xxx.1.bbb, etc.
        const currentName = this.getCurrentName();
        for (let i = 0; i < list.length; i++) {
          const obj = list[i];
          const newObj = {};
          const newKeyReplacer = currentName.substring(0, currentName.length) + '[' + i + ']';
          for (const key in obj) {
            const newKey = key.replace(currentName, newKeyReplacer);
            // console.log(newKey);
            newObj[newKey] = obj[key];
          }
          list[i] = newObj;
        }
      }
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
        const name = '[]';
        const status = context.getStatus(name) || SuperFlattenStatus.list.on;
        console.log(context.getCurrentName(name) + " - " + status);
        context.startList(name);
        superflattenList(obj, context);
        if (status === SuperFlattenStatus.list.asObject) {
          context.endObject(true);
        } else {
          context.endList();
        }

      } else if (typeof obj === 'object') {
        const name = '{}';
        const status = context.getStatus(name) || SuperFlattenStatus.object.on;
        console.log(context.getCurrentName(name) + " - " + status);
        context.startObject(name);
        superflattenObject(obj, context);
        if (status === SuperFlattenStatus.object.asList) {
          context.endList(true);
        } else {
          context.endObject();
        }
      } else {
        const status = context.getStatus() || SuperFlattenStatus.value.on;
        console.log(context.getCurrentName() + " - " + status);
        context.addValue(null, obj);
      }
    }
  }
  const superflattenObject = function(obj, context) {
    for (const key in obj) {
      const value = obj[key];
      if (Array.isArray(value)) {
        const status = context.getStatus(key) || SuperFlattenStatus.list.on;
        console.log(context.getCurrentName(key) + " - " + status);
        context.startList(key);
        superflattenList(value, context);
        if (status === SuperFlattenStatus.list.asObject) {
          context.endObject(true);
        } else {
          context.endList();
        }
      } else if (typeof value === 'object') {
        const status = context.getStatus(key) || SuperFlattenStatus.object.on;
        console.log(context.getCurrentName(key) + " - " + status);
        context.startObject(key);
        superflattenObject(value, context);
        if (status === SuperFlattenStatus.object.asList) {
          context.endList(true);
        } else {
          context.endObject();
        }
      } else {
        const status = context.getStatus(key) || SuperFlattenStatus.value.on;
        console.log(context.getCurrentName(key) + " - " + status);
        context.addValue(key, value);
      }
    }
  }
  const superflatten = function(obj, schema) {
    const context = new SuperFlattenContext();
    if (schema) {
      context.setSchema(schema);
    }
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
    var SuperFlattenCreateSchemaContext = function(type) {
      SuperFlattenContext.call(this);
      this.rootSchema = new Schema(type, '#root');
      this.currentSchema = this.rootSchema;
    }
    Object.setPrototypeOf(SuperFlattenCreateSchemaContext.prototype, SuperFlattenContext.prototype);
    const p = SuperFlattenCreateSchemaContext.prototype;
    p.startObject = function(name) {
      let schema = new Schema(Type.object, name);
      schema = this.currentSchema.addChild(schema);
      this.currentSchema = schema;
    }
    p.startList = function(name) {
      let schema = new Schema(Type.list, name);
      schema = this.currentSchema.addChild(schema);
      this.currentSchema = schema;
    }
    p.endObject = function() {
      this.currentSchema = this.currentSchema.getParent();
    }
    p.endList = function() {
      this.currentSchema = this.currentSchema.getParent();
    }
    p.addValue = function(key, value) {
      this.currentSchema.addChild(new Schema(Type.value, key));
    }
    p.applyResult = function(list) {
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

  Schema: {
    var Schema = function(type, name) {
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
    const p = Schema.prototype;
    p.getParent = function() {
      return this.parent;
    }
    p.setParent = function(parent) {
      this.parent = parent;
    }
    p.getChild = function(name) {
      return this.children[name];
    }
    p.addChild = function(schema) {
      if (!this.children[schema.getName()]) {
        this.children[schema.getName()] = schema;
        schema.setParent(this);
      }
      return this.children[schema.getName()];
    }
    p.getName = function() {
      return this.name;
    }
    p.addListSize = function(listSize) {
      this.listSize += listSize;
    }
    p.getContextName = function() {
      let contextName = '';
      let obj = this;
      while (true) {
        if (contextName.length > 0) {
          contextName = '.' + contextName;
        }
        contextName = obj.name + contextName;
        if (obj.getParent() && obj.getParent().name !== '#root') {
          obj = obj.getParent();
        } else {
          break;
        }
      }
      return contextName;
    }
  }

  const getType = function(obj) {
    let type = Type.object;
    if (Array.isArray(obj)) {
      type = Type.list;
    } else if (typeof obj === 'object'){
      type = Type.object;
    } else {
      type = Type.value;
    }
    return type;
  }

  const createSchema = function(obj) {
    const context = new SuperFlattenCreateSchemaContext(getType(obj));
    if (Array.isArray(obj)) {
      superflattenList(obj, context);
    } else if (typeof obj === 'object') {
      superflattenObject(obj, context);
    } else {
      context.root.push(obj);
    }
    return context.rootSchema;
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
    const status = schema ? schema.status : SuperFlattenStatus.list.on;
    if (status === SuperFlattenStatus.list.off) {
      return 0;
    } else if (status === SuperFlattenStatus.list.asObject) {
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
        var childSchema = schema ? schema.getChild('[]') : null;
        count += countListSize(obj, childSchema);
      } else if (typeof obj === 'object') {
        count += countObjectSize(obj, schema);
      } else {
        if (status === SuperFlattenStatus.list.on) {
          count++;
        }
      }
    }
    return count;
  }
  function countObjectSize(object, schema) {
    const status = schema ? schema.status : SuperFlattenStatus.object.on;
    if (status === SuperFlattenStatus.object.off) {
      return 1;
    }
    let count = 1;
    if (status === SuperFlattenStatus.object.asList){
      count = 0;
    }
    for (var key in object) {
      var obj = object[key];
      var childSchema = schema ? schema.children[key] : null;
      var tmp = 0;
      if (Array.isArray(obj)) {
        tmp = countListSize(obj, childSchema);
      } else if (typeof obj === 'object') {
        tmp = countObjectSize(obj, childSchema);
      } else {
        if (status === SuperFlattenStatus.object.asList){
          tmp++;
        }
      }
      if (tmp != 0) {
        if (status === SuperFlattenStatus.object.on) {
          count *= tmp;
        } else if (status === SuperFlattenStatus.object.asList){
          count += tmp;
        } else if (status === SuperFlattenStatus.object.off){
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
