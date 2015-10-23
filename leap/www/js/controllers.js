angular.module('starter.controllers', [])

.controller('DashCtrl', function($scope, leap, Fabric, FabricConstants, FabricCanvas) {
	$scope.canvas;
	$scope.pointer = [undefined, undefined];
	$scope.kspleap = {
		pick: false,
		pickCountdown: 0,
		lastPickStatus: false,
		status: "",
		circleTimes: 0,
		gestures: {
			circle: false
		},
		objects: [],
		objectShape: {
			"square": 'm -0.17857143,952.18365 100.00000043,0 0,100.00005 -100.00000043,0 z',
			"circle": 'M 99.255798,1002.3622 A 49.255798,49.255798 0 0 1 50,1051.618 49.255798,49.255798 0 0 1 0.74420166,1002.3622 49.255798,49.255798 0 0 1 50,953.10638 49.255798,49.255798 0 0 1 99.255798,1002.3622 Z',
			"triangle":'M 0.53571429,1052.1837 50,952.18366 100,1052.5408 Z'
		}
	};
	$scope.fabric = {};
	$scope.FabricConstants = FabricConstants;
	
	$scope.formatLeapPosX = function(x) {
		x += 40;
		x *= $scope.canvas.getWidth();
		x /= 250;
		x += 50;
		return x;
	};
	
	$scope.formatLeapPosY = function(y) {
		y += 0;
		y *= $scope.canvas.getHeight();
		y /= 200;
		y = $scope.canvas.getHeight() - y  + 300;
		return y;
	};
	
	var controller = leap.controller();
	controller.loop(function(frame) {
		var fingers = frame.fingers.length;
		if (frame.hands.length > 0 && frame.hands.length <= 2) {
			for (var i = 0; i < frame.hands.length; i++) {
				var hand = frame.hands[i];
				if ($scope.pointer[i] != undefined)
					$scope.canvas.remove($scope.pointer[i]);
				var handPos = [
				               $scope.formatLeapPosX(hand.palmPosition[0]),
				               $scope.formatLeapPosY(hand.palmPosition[1])
				              ];
				if (i == 0) {
					//pick gesture
					if (!$scope.kspleap.pick) {
						$scope.kspleap.pick = hand.pinchStrength > 0.69;
						$scope.kspleap.pickCountdown = 3;
					}					
					if ($scope.kspleap.pick && hand.pinchStrength < 0.25 && --$scope.kspleap.pickCountdown == 0)
						$scope.kspleap.pick = false;
					
					//pickup
					
					if (!$scope.kspleap.lastPickStatus && $scope.kspleap.pick) {
						ionic.trigger("leap.pickup", {x: handPos[0], y: handPos[1]});					
						$scope.kspleap.lastPickStatus = true;
					}
					//throw
					if ($scope.kspleap.lastPickStatus && !$scope.kspleap.pick) {
						ionic.trigger("leap.throw", {x: handPos[0], y: handPos[1]});
						$scope.kspleap.lastPickStatus = false;
					}
				}
				
				$scope.pointer[i] = new fabric.Circle({
					radius: 3,
					fill: (i == 1) ? "green" : "blue",
					selectable: false,
					left: handPos[0],
					top: handPos[1]
				});
				$scope.canvas.add($scope.pointer[i]);
				ionic.trigger('leap.hand.palm.' + i, {x: handPos[0], y: handPos[1]});
			}
		}
	});
	
	//variables
	var rectMultiple = new fabric.Rect({left: 0, top: 0, width: 4, height: 4, fill: 'green', opacity: 0.5 });
	var lastCirlceTimes = 0;
	
	$scope.isPickup = false;
	ionic.on("leap.pickup", function(e) {
		console.log("pickup");
		$scope.isPickup = true;
		var data = e.detail;
		var x = data.x;
		var y = data.y;
		
		if ($scope.kspleap.circleTimes > 0) {
			$scope.kspleap.circleTimes = 0;
			lastCircleTimes = 0;
			$scope.canvas.remove(rectMultiple);
		}
		
		//check selected group exists
		if ($scope.canvas.getActiveGroup()) {
			var obj = $scope.canvas.getActiveGroup();
			var coords = $scope.getCoords(obj);
			
			if (coords.xA <= x && x <= coords.xB && coords.yA <= y && y <= coords.yB) {
				obj.deltaX = x - coords.xA;
				obj.deltaY = y - coords.yA;
				return;
			}
		}
			
		
		//detact selected object
		$scope.canvas.deactivateAll().renderAll();
		for (var i = 0; i < $scope.kspleap.objects.length; i++) {
			var obj = $scope.kspleap.objects[i];
			var coords = $scope.getCoords(obj);
			
			if (coords.xA <= x && x <= coords.xB && coords.yA <= y && y <= coords.yB) {
				obj.deltaX = x - coords.xA;
				obj.deltaY = y - coords.yA;
				$scope.canvas.setActiveObject(obj);
				return;
			}
		}
		
	});
	
	
	
	ionic.on("leap.hand.palm.0", function(e) {
		var data = e.detail;
		var x = data.x;
		var y = data.y;
		
		if ($scope.kspleap.circleTimes == 1 && lastCircleTimes == 0) {
			rectMultiple.set({left: x, top: y, firstPoint: {x: x, y: y}});
			rectMultiple.setCoords();
			$scope.canvas.add(rectMultiple);
		} else if ($scope.kspleap.circleTimes == 1 && lastCircleTimes == 1) {
			var firstPoint = rectMultiple.firstPoint;
			var _x = firstPoint.x;
			var _y = firstPoint.y;
			if (x < _x)
				rectMultiple.setLeft(x);
			if (y < _y)
				rectMultiple.setTop(y);
			var _width = x - _x;
			var _height = y - _y;
			if (_width < 0)
				_width = -_width;
			if (_height < 0)
				_height = -_height;
			rectMultiple.set({width: _width, height: _height});
			rectMultiple.setCoords();
		} else if ($scope.kspleap.circleTimes == 2) {
			console.log("make group");
			
			var type = rectMultiple.firstPoint.x < x; //true: from left to right; false: from right to left
			
			var rectSelectedArea = $scope.getCoords(rectMultiple);
			
			var minX = 1e9;
			var minY = 1e9;
			var objs = [];
			for (var i = 0; i < $scope.kspleap.objects.length; i++) {
				var obj = $scope.kspleap.objects[i];
				var objArea = $scope.getCoords(obj);
				//right to left event
				if ((!type && rectSelectedArea.xA < objArea.xB && rectSelectedArea.xB > objArea.xA &&
					rectSelectedArea.yA < objArea.yB && rectSelectedArea.yB > objArea.yA)
					||
					(type && rectSelectedArea.xA <= objArea.xA && objArea.xB <= rectSelectedArea.xB &&
							rectSelectedArea.yA <= objArea.yA && objArea.yB <= rectSelectedArea.yB)) {
					
					obj.active = true;
					objs.push(obj);
				}
			}
			var group = new fabric.Group(objs);
			$scope.canvas._activeObject = null;
			$scope.canvas.setActiveGroup(group.setCoords()).renderAll();
			delete group;
			$scope.kspleap.circleTimes = 0;
			//remove rect selected area
			$scope.canvas.remove(rectMultiple);
			console.log();
		}
		
		if ($scope.isPickup) {
			var obj = ($scope.canvas.getActiveGroup()) ? $scope.canvas.getActiveGroup() : $scope.canvas.getActiveObject();
			
			if (!obj)
				return;
			obj.left = x - obj.deltaX;
			obj.top = y - obj.deltaY;
			//update new coordinates
			obj.setCoords();
		}
		
		//update lastCircleTimes
		lastCircleTimes = $scope.kspleap.circleTimes;
	});
	//throw event
	ionic.on("leap.throw", function() {
		$scope.isPickup = false;
		console.log("throw");
	});
	
	//make circle event
	ionic.on("leap.gesture.circleStart", function (e){
		var data = e.detail.data;
		$scope.kspleap.circleTimes = ++$scope.kspleap.circleTimes % 3;
		if ($scope.kspleap.circleTimes == 1) {
			if (rectMultiple) {
				$scope.canvas.remove(rectMultiple);
			}
		}
	});
	
	controller.on('gesture', function(e) {
		var state = e.state;
		var duration = e.duration;
		var type = e.type;
		if (type == "circle") {
			if (duration > 250000) { //250ms
				//console.log(duration);
				if ($scope.isPickup)
					return;
				if (state == "update" && !$scope.kspleap.gestures.circle) {
					ionic.trigger("leap.gesture.circleStart", {data: e});
					$scope.kspleap.gestures.circle = true;
				} else if (state == "stop" && $scope.kspleap.gestures.circle) {
					ionic.trigger("leap.gesture.circleFinish", {data: e});
					$scope.kspleap.gestures.circle = false;
				}
			}
		}
			
	});
	
	//function
	$scope.getCoords = function(obj) {
		var objCoords = obj.oCoords;
		var coords = {
				xA: objCoords.tl.x,
				yA: objCoords.tl.y,
				xB: objCoords.br.x,
				yB:	objCoords.br.y					
		};
		return coords;
	}
	$scope.addShape = function(type) {
		var path = new fabric.Path($scope.kspleap.objectShape[type]);
		path.set({ left: 0, top: 0 , stroke: "black", fill: "white", opacity: 0.5});
		$scope.canvas.add(path);
		$scope.kspleap.objects.push(path);
		$scope.kspleap.objects.sort(function(a, b) {
			return a.area - b.area;
		});
		return path;
	};
	
	//init fabric
	
	$scope.init = function() {
		$scope.fabric = new Fabric({
			JSONExportProperties: FabricConstants.JSONExportProperties,
			textDefaults: FabricConstants.textDefaults,
			shapeDefaults: FabricConstants.shapeDefaults,
			//json: $scope.main.selectedPage.json
		});
		
		$scope.canvas = FabricCanvas.getCanvas();	
		//multible select
		$scope.canvas.selection = true;
		$scope.canvas.renderOnAddRemove = true;
		$scope.fabric.setCanvasSize(1024, 450);
		$scope.addShape('square');
		circle = $scope.addShape('circle');
		triangle = $scope.addShape('triangle');
	};

	$scope.$on('canvas:created', $scope.init);
})

.controller('ChatsCtrl', function($scope, Chats) {
  // With the new view caching in Ionic, Controllers are only called
  // when they are recreated or on app start, instead of every page change.
  // To listen for when this page is active (for example, to refresh data),
  // listen for the $ionicView.enter event:
  //
  //$scope.$on('$ionicView.enter', function(e) {
  //});

  $scope.chats = Chats.all();
  $scope.remove = function(chat) {
    Chats.remove(chat);
  };
})

.controller('ChatDetailCtrl', function($scope, $stateParams, Chats) {
  $scope.chat = Chats.get($stateParams.chatId);
})

.controller('AccountCtrl', function($scope) {
  $scope.settings = {
    enableFriends: true
  };
});
