const SuperFlatten = (function() {
  SuperFlattenContext: {
    function SuperFlattenContext() {
      this.names = [];
      this.values = [];
      this.types = [];
      this.root = null;
    }
    const p = SuperFlattenContext.prototype;
    p.getCurrentName = function() {
      let ret = "";
      this.names.forEach(name => {
        if (name !== '{}') {
          if (ret.length > 0) {
            ret += '.';
          }
          ret += name;
        }
      });
      return ret;
    }
    p.getCurrentValues = function() {
      return this.values[this.values.length - 1];
    }
    p.getCurrentType = function() {
      return this.types[this.types.length - 1];
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
      obj[this.getCurrentName() + (key ? '.' + key : '')] = value;
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
        resultList = layerResultList;
      }
      this.applyResult(resultList);
    }
    p.applyResult = function(list) {
      this.types.pop();
      this.names.pop();
      const type = this.getCurrentType();
      const resultList = this.getCurrentValues();
      if (!type) {
        // !type is when context shows the root of this object.
        this.root = list;
      } else if (type === 'list') {
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
      const k = this.getCurrentName() + (key ? '.' + key : '');
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
      // } else if (type === 'list') {
      //   Array.prototype.push.apply(resultList, list);
      // } else if (type === 'object') {
      //   resultList.push(list);
      } else {
        list.forEach(elem => {
          if (!resultList.includes(elem)) {
            resultList.push(elem);
          }
        })
      }
    }
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
    return context.root;
  }

  return {superflatten, createSchema};
}());
