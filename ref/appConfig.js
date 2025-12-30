// Konfiguracny subor pre LVNL
var config = {
    defaultTheme: "A",
    firName: "EHAA",
    transitionAltitude: 3500,
    ibafDataHandlerUrl: "ibafProvider.php",
    dataHandlerUrl: "dataHandler.php",
    termsFile: "disclaimer/lvnl_tc.html",
    forceUppercaseInput: true,
    defaultDistanceUnit: "nm",
    newsletter: true,
    azureHacks: true,

    sources: {
        sdoWms: {
            url: "owsProxy.php",
            version: "1.3.0"
        },
        sdoWfs: {
            url: "owsProxy.php",
            version: "1.1.0"
        },
        wcs: {
            url: "owsProxy.php",
            version: "1.1.0"
        }
    },

    regForm: {
        phoneRequired: true,
        specialFields: {
            "companyName": {
                required: true,
                index: 9,
                pattern: /\w{0,128}/,
                ibafModel: "CompanyName"
            }
        },
        pilotTypeDefinition: {
            "pilot": {
                id: 1,
                required: ["pln"],
                notRequired: ["companyName"]
            },
            "student": {
                id: 2,
                voluntary: ["companyName"],
                notRequired: ["pln"]
            },
            "dispatcher": {
                id: 3,
                required: ["companyName"],
                notRequired: ["pln"]
            }
        },
        defaultPilotTypeId: 1
    },

    userSettings: {
        nonEditableIds: ['name', 'surname', 'companyName', 'street', 'city', 'postcode', 'countrySelect', 'phone', 'pln', 'pilotType']
    },

    newFplRoute: {
        navTypes: "Aixm-Ahp Aixm-Vor Aixm-Dpn Aixm-Dme Aixm-Tcn Aixm-Ndb Place VRP VRP_Entry"
    },

//    map: {
//        resolutions: [3, 5 ,8, 15, 25, 50, 100, 250, 380, 560, 1030, 1500, 2600, 5000, 10000, 20000, 30000]
//    },

    mapCenter: {
        lon: 642397,
        lat: 6886464,
        zoom: 8
    },

    mousePosition: {
        format: "ddmmssH dddmmssH"
    },

    routeFeatureSelector: {
        coordFormat: "ddmmssH dddmmssH"
    },

    defineRoute: {
        coord: {
            format: "ddmmH dddmmH"
        }
    },

    notamMsgsViewer: {
        defaultFir: "EH",
        resetValues: true
    },
    notamLayer: {
        ahpMarkRadius: 8,
        fillColor: "green",
        fillOpacity: 0.35,
        strokeColor1: "black",
        strokeColor2: "red"
    },
    snowtamLayer: {
        ahpMarkRadius: 4,
        fillColor: "white",
        fillOpacity: 0.35,
        strokeColor: "blue"
    },
    sigmetLayer: {
        ahpMarkRadius: 6,
        fillColor: "pink",
        fillOpacity: 0.35,
        strokeColor: "red"
    },
    meteoLayer: {
        ahpMarkRadius: 8,
        fillOpacity: 0.75,
        color: {
            synop: {
                1: "green",
                2: "yellow",
                3: "orange",
                4: "red"
            }
        }
    },
    timeRefresh: {
        mapsetItems: ["FUA Layer", "Lightnings", "Meteo Radar"]
    },

    flFilter: {
        mapsetItems: ["fir", "lfa", "prd", "tra", "tsa", "parajump", "atz", "tmz", "awy", "hpz_htz", "rmz", "glider", "cta", "tma", "ctr"],
        defaultLower: "GND",
        defaultUpper: "MAX",
        resetToDefaults: true
    },
    extraneousData: {
        mapsetItems: ["UL + Agro Airstrips", "Active UAW layer"]
    },
    meteoViewer: {
        types: ["metar", "taf", "sigmet", "forecast", "ad_warn", "gamet", "airmet"],
        warningInterval: 5,
        defaultFir: "EH",
        firFeatureType: "Aixm-Ase-FIR",
        adTaf_lastValidMsg: true
    },

    animatedMapLayers: {
        frames: 12,
        infiniteLoop: false,
        enableSerialLoading: false,
        layers: {
            "wcs_echoTop": {
                dataSource: "wcs",
                productId: "radnl25ethna"
            },
            "wcs_precipitation": {
                dataSource: "wcs",
                productId: "radnl25pcpna"
            }
        }
    },

    mapsetItemDescription: {
        items: {
            "echoTop": "images/lvnl_echoTop.png",
            "precipitation": "images/lvnl_precipitation.png"
        }
    },

    wcsImages: {
    },

    aircraft: {
        defaultAircraftSpeedUnit: "kts"
    },

    fplForm: {
        dofPreffilOffsetDays: 0,
        enableAdditionalInformations: true,
        eobtPreffilOffsetMinutes: 60,
        showHeliportName: false,
        closeFlightPlanFormAfterSend: true,
        cruisingSpeedPrefillUnit: 'N',
        setVFRLevelByRule: true,
        locationUseCodeID: true,
        addHelpDesc2OtherInfo: false,
        showOneLetterEquipments: true,
        addRmkPhone2OtherInfoEditable: false,
        picPrefillPhone: false,
        picPrefillUserName: true,
        picInputRestriction: "alphanumeric ",
        formatPhoneToPlusPrefix: true,
        oneCharViewSelectFlightRules: true,
        oneCharViewSelectTypeOfFlight: true,
        oneCharViewSelectWakeTurbulence: true,
        oneCharViewSelectCruisingSpeed: true
    },

    changeForm: {
        use16aEET: true
    },

    aipViewer: {
        types: {
            default: 1
        }
    },

    mapContext: {
        "fua": {
            mode: {
                today: {
                    mapsetItems: ["Planned CAT (FUA)", "Activated CAT (FUA)"]
                },
                tomorrow: {
                    mapsetItems: ["Airspaces FUA"]
                }
            }
        }
    },

    fuaViewer: {
        areaTypes: ["E_FUA", "CAT_FUA"],
        areaDefaultTypes: ["E_FUA", "CAT_FUA"],
        featureInfoFuaType: ["E_FUA", "CAT_FUA"],
        defaultFir: "EH",
        resetValues: true
    },

    flightLog: {
        flightStatus: {
            dep: "A",
            arr: "E",
            cnl: "C"
        }
    },

    flightPlans: {
        afterUpdateFormRefreshSleepSec: 10,
        autoFplActualRefreshTime: 15,
        mode: "aro",
        drawRouteAndShowFUAInOneBtn: true,
        showInArrMsgDOF: false,
        showPPRColumn: false,
        showArrBtnForArchive: false,
        showDeleteButtonArchive: false,
        showArrBtn: false,
        showDepBtn: false,
        showActiveFPLAfterETAHour: 3,
        acceptedStatusCodes: ['48', '53', '49', '51']
    },

    validation: {
        pilotLicenseNumberPattern: /^[\w \.\-\/\(\)]{2,30}$/,
        emailPattern: /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    },

    featureInfo: {
        openedSection: {
            "aixm-ase": "fua"
        },
        services: {
            afisToAdOprHrs: ["LH"]
        }
    },

    pams: {
        defaultFilters: {
            authorityCode: "EH",
            authorityType: "C",
            language: "EN",
            aipType: "AIP",
            aipPart: ""
        },
        enableAipModes: false
    },

    pib: {
        disableModeSelectorForPibFromFpl: false,
        requiredFirForRouteMode: true,
        mandatoryRouteMode: true
    },

    notifications: {
        values: [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80],
        default: 15
    },

    placesUrl: "places.php",
    defaultCountryCode: "NL",
    locale: "en",
    locales: ["en"]
};
