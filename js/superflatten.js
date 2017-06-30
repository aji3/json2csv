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
        for (const key in schema.getChildren()) {
          const child = schema.getChild(key);
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
        return SuperFlattenStatus.on;
      }
      return this.schemaMap[this.getCurrentName(key)] ? this.schemaMap[this.getCurrentName(key)].status : SuperFlattenStatus.on;
    }
    p.getCurrentName = function(key) {
      let ret = "";
      this.names.forEach(name => {
        // if (name !== '{}') {
          if (ret.length > 0) {
            ret += '.';
          }
          ret += name;
        // }
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
    p.startChild = function(type, name) {
      this.values.push([]);
      this.names.push(name);
      this.types.push(type);
    }
    p.addValue = function(key, value) {
      let obj = {};
      let name = this.getCurrentName(key);
      obj[name] = value;
      this.getCurrentValues().push(obj);
    }
    p.endChild = function(type, status) {
      // console.log(this.getCurrentType() + " " + type);
      if (type === Type.list) {
        if (status === SuperFlattenStatus.list.asObject) {
          this.endObject(true);
        } else {
          this.endList();
        }
      } else if (type === Type.object) {
        if (status === SuperFlattenStatus.object.asList) {
          this.endList(true);
        } else {
          this.endObject();
        }
      }
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
            const reg = `${currentName.replace(/\[\]/g, '\\[\\]')}\\.([^\\.]+)\\.?`;
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
          // if (typeof obj === 'object') {
            for (const key in obj) {
              const newKey = key.replace(currentName, newKeyReplacer);
              // console.log(newKey);
              if (typeof obj === 'object') {
                newObj[newKey] = obj[key];
              }
            }
          // } else {
          //   newObj[newKeyReplacer] = obj;
          // }
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

  SuperFlatten: {
    var superflatten = function(obj, schema) {
      const context = new SuperFlattenContext();
      if (schema) {
        context.setSchema(schema);
      }
      const status = schema ? schema.status : SuperFlattenStatus.on;
      if (Array.isArray(obj)) {
        context.startChild(Type.list, '[]');
        superflattenList(obj, context);
        context.endChild(Type.list, status);
      } else if (typeof obj === 'object') {
        context.startChild(Type.object, '{}');
        superflattenObject(obj, context);
        context.endChild(Type.object, status);
      } else {
        context.root = [obj];
      }
      return context.root;
    }
    var superflattenList = function(list, context) {
      for (var i = 0; i < list.length; i++) {
        const obj = list[i];
        if (Array.isArray(obj)) {
          const name = '[]';
          const status = context.getStatus(name);
          if (status === SuperFlattenStatus.list.off) continue;
          console.log(context.getCurrentName(name) + " - " + status);
          context.startChild(Type.list, name);
          superflattenList(obj, context);
          context.endChild(Type.list, status);
        } else if (typeof obj === 'object') {
          const name = '{}';
          const status = context.getStatus(name);
          if (status === SuperFlattenStatus.object.off) continue;
          console.log(context.getCurrentName(name) + " - " + status);
          context.startChild(Type.object, name);
          superflattenObject(obj, context);
          context.endChild(Type.object, status);
        } else {
          const status = context.getStatus();
          if (status === SuperFlattenStatus.value.off) continue;
          console.log(context.getCurrentName() + " - " + status);
          context.addValue(null, obj);
        }
      }
    }
    var superflattenObject = function(obj, context) {
      for (const key in obj) {
        const value = obj[key];
        const status = context.getStatus(key);
        if (status === SuperFlattenStatus.off) continue;
        console.log(context.getCurrentName(key) + " - " + status);
        if (Array.isArray(value)) {
          context.startChild(Type.list, key);
          superflattenList(value, context);
          context.endChild(Type.list, status);
        } else if (typeof value === 'object') {
          context.startChild(Type.object, key);
          superflattenObject(value, context);
          context.endChild(Type.object, status);
        } else {
          context.addValue(key, value);
        }
      }
    }
  }

  SuperFlattenCreateSchemaContext: {
    var SuperFlattenCreateSchemaContext = function(type) {
      SuperFlattenContext.call(this);
      // this.rootSchema = new Schema(type, '#root');
      // this.currentSchema = this.rootSchema;
    }
    Object.setPrototypeOf(SuperFlattenCreateSchemaContext.prototype, SuperFlattenContext.prototype);
    const p = SuperFlattenCreateSchemaContext.prototype;
    p.startChild = function(type, name) {
      let schema = new Schema(type, name);
      if (!this.rootSchema) {
        this.rootSchema = schema;
        this.currentSchema = schema;
      } else {
        schema = this.currentSchema.addChild(schema);
        this.currentSchema = schema;
      }
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
    on: 'ON',
    off: 'OFF',
    object: {
      on: 'ON', // should be the same as SuperFlattenStatus.on
      asList: 'AS_LIST',
      off: 'OFF' // should be the same as SuperFlattenStatus.off
    },
    list: {
      on: 'ON', // should be the same as SuperFlattenStatus.on
      asObject: 'AS_OBJECT',
      off: 'OFF' // should be the same as SuperFlattenStatus.off
    },
    value: {
      on: 'ON', // should be the same as SuperFlattenStatus.on
      off: 'OFF' // should be the same as SuperFlattenStatus.off
    }
  }

  Schema: {
    var Schema = function(type, name) {
      this.type = type;
      this.name = name;
      this.parent = null;
      this.children = {};
      this.listSize = 0;
      this.status = SuperFlattenStatus.on;
      // switch (type) {
      //   case 'object':
      //     this.status = SuperFlattenStatus.object.on;
      //     break;
      //   case 'list':
      //     this.status = SuperFlattenStatus.list.on;
      //     break;
      //   case 'value':
      //     this.status = SuperFlattenStatus.value.on;
      //     break;
      //   default:
      //     break;
      // }
    }
    const p = Schema.prototype;
    p.getParent = function() {
      return this.parent;
    }
    p.setParent = function(parent) {
      this.parent = parent;
    }
    p.getChildren = function() {
      return this.children;
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
      const status = context.getStatus('[]');
      context.startChild(Type.list, '[]');
      superflattenList(obj, context);
      context.endChild(Type.list, status);
    } else if (typeof obj === 'object') {
      const status = context.getStatus('{}');
      context.startChild(Type.object, '{}');
      superflattenObject(obj, context);
      context.endChild(Type.object, status);
    } else {
      context.root.push(obj);
    }
    return context.rootSchema;
  }

  countSize: {
    var countSize = function(obj, schema) {
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
          const childSchema = schema ? schema.getChild('[]') : null;
          count += countListSize(obj, childSchema);
        } else if (typeof obj === 'object') {
          const childSchema = schema ? schema.getChild('{}') : null;
          count += countObjectSize(obj, childSchema);
        } else {
          if (status === SuperFlattenStatus.list.on) {
            count++;
          }
        }
      }
      return count;
    }
    function countObjectSize(object, schema) {
      if (!object || Object.keys(object).length == 0) {
        return 0;
      }
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
        var childSchema = schema ? schema.getChild(key) : null;
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
  }

  return {superflatten, createSchema, countSize};
}());
