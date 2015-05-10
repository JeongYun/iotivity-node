require( "../setup" );

var iotivity = require( "../../index" ),
	testUtils = require( "../test-utils" )( iotivity, QUnit.assert );

test( "Simple server", function( assert ) {
	var result, stopProcessing, stopTestClient, keyCount,
		done = assert.async(),
		handlerWasCalled = false,
		failsafeTimeoutId = null,
		handle = {},

		// Clean up before we exit
		teardown = function() {

			// Kill the test client process
			if ( stopTestClient ) {
				stopTestClient();
			}

			// Stop the processing loop
			if ( stopProcessing ) {
				stopProcessing();
			}

			// Remove the failsafe timer
			if ( failsafeTimeoutId !== null ) {
				clearTimeout( failsafeTimeoutId );
				failsafeTimeoutId = null;
			}

			// Make sure the entity handler was called
			assert.deepEqual( handlerWasCalled, true, "Entity handler was called" );

			// Make sure OCDeleteResource works correctly, including the callback removal on the
			// C++ side
			keyCount = Object.keys( iotivity._test_callbacks ).length;
			result = iotivity.OCDeleteResource( handle );
			assert.deepEqual(
				testUtils.lookupEnumValueName( "OCStackResult", result ),
				"OC_STACK_OK",
				"OCDeleteResource succeeded" );
			assert.deepEqual(
				Object.keys( iotivity._test_callbacks ).length,
				keyCount - 1,
				"The number of keys in the list of callbacks has decreased by one" );

			// Make sure stack shutdown works
			testUtils.testShutdown();

			// Inform QUnit that this async test has concluded
			done();
		},

		// We store the location of the entity handler, because we want to make sure that it is
		// getting stored in the correct place on the C++ side
		callback = function( flag, request ) {
			handlerWasCalled = true;
			teardown();
		};

	// Make sure the stack starts up correctly
	if ( testUtils.testStartup( iotivity.OCMode.OC_SERVER ) ===
			iotivity.OCStackResult.OC_STACK_OK ) {

		// Make sure OCCreateResource works correctly, including the callback manipulation on the
		// C++ side
		keyCount = Object.keys( iotivity._test_callbacks ).length;
		result = iotivity.OCCreateResource(
			handle,
			"core.light",
			"oc.mi.def",
			"/a/light",
			callback,
			iotivity.OCResourceProperty.OC_DISCOVERABLE |
			iotivity.OCResourceProperty.OC_OBSERVABLE );
		assert.deepEqual(
			testUtils.lookupEnumValueName( "OCStackResult", result ),
			"OC_STACK_OK",
			"OCCreateResource succeeded" );
		assert.deepEqual( typeof handle.uuid, "number", "uuid is present" );
		assert.deepEqual(
			Object.keys( iotivity._test_callbacks ).length,
			keyCount + 1,
			"The number of keys in the list of callbacks has increased by one" );
		assert.deepEqual( iotivity._test_callbacks[ handle.uuid ], callback,
			"The JS callback is present in the list of callbacks at the correct uuid" );

		// If OCCreateResource was successful, we can make sure the entity handler gets called
		if ( result === iotivity.OCStackResult.OC_STACK_OK ) {

			// Start the processing loop
			stopProcessing = testUtils.testProcessing( 100, function() {
				teardown();
			} );

			// If the entity handler does not get called within five seconds, give up
			failsafeTimeoutId = setTimeout( function() {
				failsafeTimeoutId = null;
				teardown();
			}, 5000 );

			// Start a test client which will send a request to the server under test
			stopTestClient = testUtils.startTestClient( function() {
				teardown();
			} );
		}
	}
} );